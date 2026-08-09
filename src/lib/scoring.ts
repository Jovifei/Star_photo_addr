// Scoring engine (ported from star-weather's scoring.js to TypeScript).
//
// Faithful port of evaluateHour / evaluateNight / statusMeta. Time parsing is
// timezone-aware (see nighttime.parseProviderTime) so astronomy and the night
// window are computed in the location's local timezone.

import { astronomyAt, moonPhaseName } from "./astronomy";
import { formatHour, isInNight, parseProviderTime } from "./nighttime";
import type {
  HourEvaluation,
  HourWeather,
  Location,
  LocationForecast,
  NightEvaluation,
  NightStatus,
} from "./types";

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));
const scale = (value: number, low: number, high: number): number =>
  clamp(((value - low) / (high - low)) * 100);

export const SCORE_MODEL_VERSION = "star-v1.0";

function evaluateHour(
  hour: HourWeather,
  location: Location,
  utcOffsetSeconds: number,
): HourEvaluation {
  const astro = astronomyAt(
    parseProviderTime(hour.time, utcOffsetSeconds),
    location,
  );
  const clearSky = clamp(
    100 -
      (0.4 * (hour.cloudCover ?? 100) +
        0.2 * (hour.cloudLow ?? hour.cloudCover ?? 100) +
        0.2 * (hour.cloudMid ?? hour.cloudCover ?? 100) +
        0.2 * (hour.cloudHigh ?? hour.cloudCover ?? 100)),
  );
  const precipitation = clamp(
    100 -
      Math.max(
        hour.precipitationProbability ?? 0,
        Math.min(100, (hour.precipitation ?? 0) * 160),
      ),
  );
  const dewSpread = (hour.temperature ?? 0) - (hour.dewPoint ?? hour.temperature ?? 0);
  const visibilityScore = scale(hour.visibility ?? 10000, 3000, 30000);
  const humidityScore = 100 - scale(hour.humidity ?? 80, 45, 100);
  const dewScore = scale(dewSpread, 1, 10);
  const transparency = (visibilityScore + humidityScore + dewScore) / 3;
  const windScore = clamp(
    100 - scale(hour.windSpeed ?? 0, 3, 12) * 0.65 - scale(hour.windGust ?? 0, 6, 18) * 0.35,
  );
  const darkness =
    astro.sunAltitude <= -18
      ? 100
      : astro.sunAltitude >= -12
        ? 0
        : ((-12 - astro.sunAltitude) / 6) * 100;
  const moonAltitudeFactor = clamp((astro.moonAltitude + 5) / 50, 0, 1);
  const moonlight = clamp(100 - astro.moonIllumination * moonAltitudeFactor * 100);
  const score = Math.round(
    clearSky * 0.35 +
      precipitation * 0.2 +
      transparency * 0.15 +
      windScore * 0.1 +
      darkness * 0.1 +
      moonlight * 0.1,
  );
  const blockers: string[] = [];
  if ((hour.weatherCode ?? 0) >= 95) blockers.push("雷暴风险");
  if ((hour.precipitation ?? 0) >= 0.2 || (hour.precipitationProbability ?? 0) >= 70)
    blockers.push("降水风险");
  if ((hour.visibility ?? Infinity) < 3000) blockers.push("能见度过低");
  if ((hour.windGust ?? 0) >= 15) blockers.push("阵风过大");
  if ((hour.cloudCover ?? 0) >= 95) blockers.push("完全云量过高");
  const quality: HourEvaluation["quality"] = blockers.length
    ? "blocked"
    : score >= 76
      ? "excellent"
      : score >= 62
        ? "candidate"
        : "poor";
  return {
    ...hour,
    ...astro,
    score,
    quality,
    blockers,
    components: { clearSky, precipitation, transparency, wind: windScore, darkness, moonlight },
  };
}

function longestWindow(hours: HourEvaluation[], threshold = 62): HourEvaluation[] {
  let best: HourEvaluation[] = [];
  let current: HourEvaluation[] = [];
  hours.forEach((hour) => {
    if (hour.score >= threshold && !hour.blockers.length && hour.sunAltitude < -12) {
      current.push(hour);
      if (current.length > best.length) best = [...current];
    } else {
      current = [];
    }
  });
  return best;
}

function confidenceForLead(index: number, completeness: number) {
  if (completeness < 0.85)
    return { level: "低", kind: "low" as const, reason: "关键字段不完整" };
  if (index <= 2)
    return { level: "高", kind: "high" as const, reason: "72 小时内" };
  if (index <= 6)
    return { level: "中", kind: "medium" as const, reason: "4–7 天规划" };
  return { level: "趋势", kind: "trend" as const, reason: "8 天后不确定性较高" };
}

function buildReason(args: {
  status: NightStatus;
  window: HourEvaluation[];
  blockers: string[];
  cloudSeaPotential: number;
  confidence: { kind: string };
}): string {
  if (args.confidence.kind === "trend")
    return "远期趋势，仅用于规划，临近 72 小时再确认";
  if (args.status === "go")
    return `连续窗口 ${args.window.length} 小时，云量和降水条件较好`;
  if (args.blockers.length) return args.blockers.slice(0, 2).join("、");
  if (args.cloudSeaPotential >= 65) return "低云条件明显，星空不稳但可关注云海";
  return "窗口偏短或模型条件不稳定";
}

export function evaluateNight(
  forecast: LocationForecast,
  location: Location,
  nightKey: string,
  leadIndex = 0,
): NightEvaluation | null {
  const offset = forecast.utcOffsetSeconds ?? 0;
  const source = forecast.hourly.filter((hour) => isInNight(hour.time, nightKey));
  const hours = source.map((hour) => evaluateHour(hour, location, offset));
  if (!hours.length) return null;

  const window = longestWindow(hours);
  const ranked = [...hours]
    .filter((hour) => hour.sunAltitude < -12)
    .sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, Math.min(3, ranked.length));
  const average = top.length
    ? top.reduce((sum, hour) => sum + hour.score, 0) / top.length
    : 0;
  const minimum = top.length ? Math.min(...top.map((hour) => hour.score)) : 0;
  const score = Math.round(average * 0.7 + minimum * 0.3);

  const cloudSeaPotential = Math.round(
    clamp(
      hours.reduce((sum, hour) => {
        const lowCloudBand = 100 - Math.abs((hour.cloudLow ?? 0) - 65) * 1.35;
        const calm = clamp(100 - (hour.windSpeed ?? 0) * 8);
        const dry = 100 - (hour.precipitationProbability ?? 0);
        const upperClear = 100 - Math.max(hour.cloudMid ?? 0, hour.cloudHigh ?? 0);
        return (
          sum +
          clamp(lowCloudBand) * 0.45 +
          calm * 0.2 +
          dry * 0.2 +
          upperClear * 0.15
        );
      }, 0) / hours.length,
    ),
  );

  const validFields = source.reduce(
    (count, hour) =>
      count +
      Object.values(hour).filter((value) => value !== null && value !== undefined)
        .length,
    0,
  );
  const completeness = validFields / Math.max(1, source.length * 13);
  const confidence = confidenceForLead(leadIndex, completeness);
  const blockers = [...new Set(hours.flatMap((hour) => hour.blockers))];
  const status: NightStatus =
    leadIndex >= 7
      ? "trend"
      : window.length >= 2 && score >= 72
        ? "go"
        : score >= 56
          ? "watch"
          : "no";
  const bestStart = window[0]?.time;
  const bestEnd = window.at(-1)?.time;
  const moon = hours[Math.floor(hours.length / 2)] ?? hours[0];

  return {
    nightKey,
    score,
    cloudSeaPotential,
    status,
    confidence,
    hours,
    window,
    windowLabel: window.length
      ? `${formatHour(bestStart ?? "")}–${formatHour(bestEnd ?? "")}（${window.length}h）`
      : "暂无连续窗口",
    darkHours: hours.filter((hour) => hour.sunAltitude <= -18).length,
    galacticMax: Math.round(Math.max(...hours.map((hour) => hour.galacticAltitude))),
    moonIllumination: moon.moonIllumination,
    moonPhase: moonPhaseName(moon.moonIllumination),
    blockers,
    reason: buildReason({ status, window, blockers, cloudSeaPotential, confidence }),
    scoreModelVersion: SCORE_MODEL_VERSION,
  };
}

export function statusMeta(status: NightStatus) {
  return (
    {
      go: { label: "推荐", tone: "good" },
      watch: { label: "候选", tone: "warn" },
      no: { label: "不建议", tone: "bad" },
      trend: { label: "趋势", tone: "muted" },
    }[status] ?? { label: "无数据", tone: "muted" }
  );
}
