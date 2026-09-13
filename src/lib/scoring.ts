// Night astronomy score. This is a best-window forecast, NOT an arrival-time observation.
import { moonPhaseName } from "./astronomy";
import { formatHour, isInNight } from "./nighttime";
import { forecastTrustIssue, missingNightInputs } from "./forecastIntegrity";
import { scoreHour } from "./hourScore";
import type { HourEvaluation, HourWeather, Location, LocationForecast, NightEvaluation, NightStatus } from "./types";

const clamp = (value: number, min = 0, max = 100): number => Math.min(max, Math.max(min, value));
export const SCORE_MODEL_VERSION = "star-v1.2-integrity";

/** Called only after missingNightInputs; no clear-weather defaults for missing core fields. */
function evaluateHour(hour: HourWeather, location: Location, utcOffsetSeconds: number): HourEvaluation {
  const result = scoreHour(hour, location, utcOffsetSeconds);
  if (!result) throw new Error("关键天气字段缺失，不能计算小时评分");
  return result;
}
function timestamp(time: string): number { return Date.parse(`${time}Z`); }
function longestWindow(hours: HourEvaluation[], threshold = 62): HourEvaluation[] {
  let best: HourEvaluation[] = [];
  let current: HourEvaluation[] = [];
  for (const hour of hours) {
    const previous = current.at(-1);
    if (previous && timestamp(hour.time) - timestamp(previous.time) !== 3_600_000) current = [];
    if (hour.score >= threshold && !hour.blockers.length && hour.sunAltitude < -12) {
      current.push(hour);
      if (current.length > best.length) best = [...current];
    } else current = [];
  }
  return best;
}
/** Replace the three unrelated best hours with the best truly contiguous, unblocked 3-hour window. */
function bestThreeHours(hours: HourEvaluation[]): HourEvaluation[] {
  let best: HourEvaluation[] = [];
  let bestScore = -1;
  for (let i = 0; i + 2 < hours.length; i += 1) {
    const part = hours.slice(i, i + 3);
    if (part.some((hour) => hour.sunAltitude >= -12 || hour.blockers.length)) continue;
    if (timestamp(part[1]!.time) - timestamp(part[0]!.time) !== 3_600_000 || timestamp(part[2]!.time) - timestamp(part[1]!.time) !== 3_600_000) continue;
    const score = part.reduce((sum, hour) => sum + hour.score, 0) / 3;
    if (score > bestScore) { best = part; bestScore = score; }
  }
  return best;
}
export function evaluateNight(forecast: LocationForecast, location: Location, nightKey: string, leadIndex = 0): NightEvaluation | null {
  if (forecastTrustIssue(forecast)) return null;
  if (!Number.isFinite(forecast.utcOffsetSeconds)) return null;
  const source = forecast.hourly.filter((hour) => isInNight(hour.time, nightKey)).sort((a, b) => a.time.localeCompare(b.time));
  if (source.length < 7 || new Set(source.map((hour) => hour.time)).size !== source.length) return null;
  if (source.some((hour) => !Number.isFinite(timestamp(hour.time)) || missingNightInputs(hour).length > 0)) return null;
  const hours = source.map((hour) => evaluateHour(hour, location, forecast.utcOffsetSeconds));
  const window = longestWindow(hours);
  const top = bestThreeHours(hours);
  // Without a 3-hour window, show an all-dark-hour summary and explicitly do not recommend it.
  const summaryHours = top.length ? top : hours.filter((hour) => hour.sunAltitude < -12);
  const average = summaryHours.length ? summaryHours.reduce((sum, hour) => sum + hour.score, 0) / summaryHours.length : 0;
  const minimum = summaryHours.length ? Math.min(...summaryHours.map((hour) => hour.score)) : 0;
  const score = Math.round(average * 0.7 + minimum * 0.3);
  const confidence = leadIndex >= 7
    ? { level: "趋势", kind: "trend" as const, reason: "8 天后趋势；单模型，未核验模型分歧" }
    : { level: "中", kind: "medium" as const, reason: "字段完整不等于预报准确；单模型，未核验模型分歧" };
  const blockers = [...new Set(hours.flatMap((hour) => hour.blockers))];
  const status: NightStatus = leadIndex >= 7
    ? "trend"
    : blockers.length
      ? "no"
      : top.length === 3 && window.length >= 3 && score >= 72
        ? "go"
        : score >= 56
          ? "watch"
          : "no";
  const moon = hours[Math.floor(hours.length / 2)]!;
  const cloudSeaPotential = Math.round(clamp(hours.reduce((sum, hour) => {
    const lowCloudBand = 100 - Math.abs(hour.cloudLow! - 65) * 1.35;
    return sum + clamp(lowCloudBand) * 0.45 + clamp(100 - hour.windSpeed! * 8) * 0.2 +
      (100 - (hour.precipitationProbability ?? 0)) * 0.2 + (100 - Math.max(hour.cloudMid!, hour.cloudHigh!)) * 0.15;
  }, 0) / hours.length));
  const scoredWindow = top.length ? top : window;
  return {
    nightKey, score, cloudSeaPotential, status, confidence, hours, window: scoredWindow,
    windowLabel: scoredWindow.length ? `${formatHour(scoredWindow[0]!.time)}–${formatHour(scoredWindow.at(-1)!.time)}（${scoredWindow.length} 个连续小时采样）` : "暂无连续窗口",
    darkHours: hours.filter((hour) => hour.sunAltitude <= -18).length,
    galacticMax: Math.round(Math.max(...hours.map((hour) => hour.galacticAltitude))),
    moonIllumination: moon.moonIllumination, moonPhase: moonPhaseName(moon.moonIllumination), blockers,
    reason: top.length ? "整晚最佳连续 3 小时预报分，不代表当前时次或现场保证；出发前复核云图与预警" : "无完整连续 3 小时窗口；分数为暗夜时次参考，不构成出行推荐",
    scoreModelVersion: SCORE_MODEL_VERSION,
    scoreBasis: "night-best-contiguous-window",
    scoreTime: top[0]?.time ?? null,
    aggregation: top.length === 3 ? "best-contiguous-3h" : "dark-hours-fallback",
  };
}
export function statusMeta(status: NightStatus) {
  return ({ go: { label: "推荐", tone: "good" }, watch: { label: "候选", tone: "warn" }, no: { label: "不建议", tone: "bad" }, trend: { label: "趋势", tone: "muted" } }[status] ?? { label: "无数据", tone: "muted" });
}
