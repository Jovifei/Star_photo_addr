import { FINDER_LOCATIONS } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import type {
  FinderLocation,
  FinderMode,
  FinderWeatherRecord,
} from "@/lib/stargazingFinderTypes";
import type {
  ForecastModel,
  ObservationSnapshot,
  ObservingSite,
  RecommendationBand,
  RecommendationConfidence,
  RecommendationScore,
} from "@/lib/types";

export const OBSERVING_SITE_COUNT = FINDER_LOCATIONS.length;
export const DEFAULT_RECOMMENDATION_THRESHOLD = 70;
export const MAX_SHORTLIST_SIZE = 12;

/** The one Adapter used by both product routes. */
export function finderLocationToObservingSite(
  location: FinderLocation,
): ObservingSite {
  return {
    id: location.id,
    name: location.name,
    province: location.province,
    area: location.area,
    latitude: location.latitude,
    longitude: location.longitude,
    altitude: location.elevation,
    bortle: location.bortle,
    description: location.reason,
  };
}

export const OBSERVING_SITES: ObservingSite[] = FINDER_LOCATIONS.map(
  finderLocationToObservingSite,
);

export function observingSiteToLocation(site: ObservingSite) {
  return {
    id: site.id,
    name: site.name,
    latitude: site.latitude,
    longitude: site.longitude,
    elevation: site.altitude,
    source: "参考点位" as const,
    bortle: site.bortle,
    province: site.province,
    area: site.area,
    description: site.description,
  };
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function numberAt(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isNightHour(time: string, date: string): boolean {
  const nextDate = addDays(date, 1);
  const hour = Number(time.slice(11, 13));
  return (
    (time.startsWith(date) && hour >= 20) ||
    (time.startsWith(nextDate) && hour <= 5)
  );
}

function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function formatWindow(times: string[]): string | null {
  if (!times.length) return null;
  return `${times[0]?.slice(11, 16)}–${times.at(-1)?.slice(11, 16)}（${times.length}h）`;
}

function bandFor(score: number, blocker: boolean): RecommendationBand {
  if (blocker) return "not-recommended";
  if (score >= 85) return "priority";
  if (score >= 70) return "recommended";
  if (score >= 55) return "watch";
  return "not-recommended";
}

function darknessScore(bortle: ObservingSite["bortle"]): number {
  return ({ 1: 100, 2: 90, 3: 78, 4: 62 } as const)[bortle];
}

function scoreConfidence(
  validHours: number,
  totalHours: number,
): RecommendationConfidence {
  if (!validHours) return "unknown";
  const ratio = validHours / Math.max(1, totalHours);
  if (ratio >= 0.8) return "high";
  if (ratio >= 0.6) return "medium";
  return "low";
}

function unknownHourScore(
  site: ObservingSite,
  blockers: string[],
): RecommendationScore {
  return {
    score: null,
    band: "unknown",
    cloud: null,
    darkness: darknessScore(site.bortle),
    weatherRisk: null,
    bestWindow: null,
    blockers,
    confidence: "unknown",
    validHours: 0,
  };
}

interface ClearWindowRow {
  time: string;
  cloud: number | null;
}

function wallClockMillis(time: string): number {
  const normalized = time.length === 16 ? `${time}:00Z` : `${time}Z`;
  return Date.parse(normalized);
}

/**
 * Find the clearest truly contiguous window.
 *
 * The previous implementation filtered cloudy hours first and then sliced the
 * filtered list, which could falsely join 20:00, 22:00 and 23:00 into a “3h”
 * window. This helper groups exact one-hour neighbours before considering any
 * candidate window.
 */
export function findBestContiguousWindow(
  rows: ClearWindowRow[],
  minimumHours = 3,
): string[] {
  if (minimumHours < 1) return [];
  const sorted = [...rows]
    .filter((row) => Number.isFinite(wallClockMillis(row.time)))
    .sort((left, right) =>
      left.time.localeCompare(right.time),
    );
  const groups: ClearWindowRow[][] = [];
  for (const row of sorted) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (
      !group ||
      !previous ||
      wallClockMillis(row.time) - wallClockMillis(previous.time) !== 3_600_000
    ) {
      groups.push([row]);
    } else {
      group.push(row);
    }
  }

  const candidates = groups.flatMap((group) => {
    if (group.length < minimumHours) return [];
    return Array.from(
      { length: group.length - minimumHours + 1 },
      (_, index) => group.slice(index, index + minimumHours),
    );
  });
  candidates.sort((left, right) => {
    const average = (items: ClearWindowRow[]) =>
      items.reduce((sum, item) => sum + (item.cloud ?? 100), 0) /
      items.length;
    return average(left) - average(right) ||
      left[0]!.time.localeCompare(right[0]!.time);
  });
  return candidates[0]?.map((row) => row.time) ?? [];
}

/** Compute the shared score for one exact forecast hour. */
export function scoreObservingSiteAtTime(
  site: ObservingSite,
  record: FinderWeatherRecord | undefined,
  time: string,
): RecommendationScore {
  const hourly = record?.hourly;
  const index = hourly?.time?.indexOf(time) ?? -1;
  if (!hourly || index < 0) {
    return unknownHourScore(site, ["此时暂无天气数据"]);
  }

  const cloud = numberAt(hourly.cloud_cover, index);
  if (cloud === null) {
    return unknownHourScore(site, ["此时云量数据缺失"]);
  }

  const precipitation = numberAt(hourly.precipitation, index);
  const wind = numberAt(hourly.wind_speed_10m, index);
  const gust = numberAt(hourly.wind_gusts_10m, index);
  const weatherCode = numberAt(hourly.weather_code, index);
  const cloudScore = clamp(100 - cloud);
  const weatherRisk = clamp(
    100 -
      (precipitation != null && precipitation >= 0.5 ? 75 : 0) -
      Math.max(0, (wind ?? 0) - 4) * 3 -
      Math.max(0, (gust ?? 0) - 8) * 2,
  );
  const blockers = [
    ...(weatherCode != null && weatherCode >= 95 ? ["雷暴风险"] : []),
    ...(precipitation != null && precipitation >= 0.5
      ? ["小时降水达到 0.5 mm"]
      : []),
    ...(gust != null && gust >= 15 ? ["阵风达到 15 m/s"] : []),
  ];
  const score = Math.round(
    cloudScore * 0.55 +
      darknessScore(site.bortle) * 0.3 +
      weatherRisk * 0.15,
  );

  return {
    score,
    band: bandFor(score, blockers.length > 0),
    cloud,
    darkness: darknessScore(site.bortle),
    weatherRisk: Math.round(weatherRisk),
    bestWindow: null,
    blockers,
    confidence: "high",
    validHours: 1,
  };
}

/** Compute the shared 0–100 recommendation score from one night's raw data. */
export function scoreObservingSite(
  site: ObservingSite,
  record: FinderWeatherRecord | undefined,
  date: string,
  mode: FinderMode = "photo",
): RecommendationScore {
  const hourly = record?.hourly;
  if (!hourly?.time?.length) {
    return {
      score: null,
      band: "unknown",
      cloud: null,
      darkness: darknessScore(site.bortle),
      weatherRisk: null,
      bestWindow: null,
      blockers: ["暂无逐小时天气数据"],
      confidence: "unknown",
      validHours: 0,
    };
  }

  const indexes = hourly.time
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => isNightHour(time, date));
  const rows = indexes.map(({ time, index }) => ({
    time,
    cloud: numberAt(hourly.cloud_cover, index),
    precipitation: numberAt(hourly.precipitation, index),
    probability: null,
    wind: numberAt(hourly.wind_speed_10m, index),
    gust: numberAt(hourly.wind_gusts_10m, index),
    weatherCode: numberAt(hourly.weather_code, index),
  }));
  const validRows = rows.filter((row) => row.cloud !== null);
  const validHours = validRows.length;
  const confidence = scoreConfidence(validHours, rows.length);
  if (!rows.length || validHours < Math.ceil(rows.length * 0.7)) {
    return {
      score: null,
      band: "unknown",
      cloud: null,
      darkness: darknessScore(site.bortle),
      weatherRisk: null,
      bestWindow: null,
      blockers: ["有效天气时次不足 70%"],
      confidence,
      validHours,
    };
  }

  const cloudValues = validRows.flatMap((row) =>
    row.cloud == null ? [] : [row.cloud],
  );
  const rainValues = rows.flatMap((row) =>
    row.precipitation == null ? [] : [row.precipitation],
  );
  const windValues = rows.flatMap((row) =>
    row.wind == null ? [] : [row.wind],
  );
  const gustValues = rows.flatMap((row) =>
    row.gust == null ? [] : [row.gust],
  );
  const averageCloud = cloudValues.length
    ? cloudValues.reduce((sum, value) => sum + value, 0) / cloudValues.length
    : null;
  const maxWind = windValues.length ? Math.max(...windValues) : null;
  const maxGust = gustValues.length ? Math.max(...gustValues) : null;
  const rainCount = rainValues.filter((value) => value >= 0.5).length;
  const cloudScore = averageCloud == null ? null : clamp(100 - averageCloud);
  const weatherRisk = clamp(
    100 -
      (rainCount / Math.max(1, validHours)) * 75 -
      Math.max(0, (maxWind ?? 0) - 4) * 3 -
      Math.max(0, (maxGust ?? 0) - 8) * 2,
  );
  const hardBlockers = [
    ...(rows.some(
      (row) => row.weatherCode != null && row.weatherCode >= 95,
    )
      ? ["雷暴风险"]
      : []),
    ...(rows.some(
      (row) => row.precipitation != null && row.precipitation >= 0.5,
    )
      ? ["小时降水达到 0.5 mm"]
      : []),
    ...(rows.some((row) => row.gust != null && row.gust >= 15)
      ? ["阵风达到 15 m/s"]
      : []),
  ];
  const rawScore = Math.round(
    (cloudScore ?? 0) * 0.55 +
      darknessScore(site.bortle) * 0.3 +
      weatherRisk * 0.15,
  );
  const clearRows = rows.filter(
    (row) =>
      row.cloud != null &&
      row.cloud <= (mode === "visual" ? 60 : 50) &&
      (row.precipitation == null || row.precipitation < 0.5) &&
      (row.gust == null || row.gust < 15),
  );
  const bestWindow = findBestContiguousWindow(clearRows, 3);

  return {
    score: rawScore,
    band: bandFor(rawScore, hardBlockers.length > 0),
    cloud: cloudScore == null ? null : Math.round(averageCloud ?? 0),
    darkness: darknessScore(site.bortle),
    weatherRisk: Math.round(weatherRisk),
    bestWindow: formatWindow(bestWindow),
    blockers: hardBlockers,
    confidence,
    validHours,
  };
}

export function buildObservationSnapshot(
  date: string,
  days: 1 | 3 | 5 | 7,
  model: ForecastModel,
  weatherByDate: Record<string, Record<string, FinderWeatherRecord>>,
  focusTime?: string,
): ObservationSnapshot {
  const sites: Record<string, RecommendationScore[]> = {};
  const dates = Array.from({ length: days }, (_, index) =>
    addDays(date, index),
  );
  for (const site of OBSERVING_SITES) {
    sites[site.id] = dates.map((night) =>
      scoreObservingSite(site, weatherByDate[night]?.[site.id], night),
    );
  }
  const records = Object.values(weatherByDate).flatMap((value) =>
    Object.values(value),
  );
  const focusScores = focusTime
    ? Object.fromEntries(
        OBSERVING_SITES.map((site) => [
          site.id,
          scoreObservingSiteAtTime(
            site,
            weatherByDate[date]?.[site.id],
            focusTime,
          ),
        ]),
      )
    : undefined;
  return {
    date,
    days,
    model,
    generatedAt: new Date().toISOString(),
    source:
      "Open-Meteo Forecast API + curated dark-sky site metadata",
    stale: records.some(
      (record) => record.status === "stale" || record.status === "error",
    ),
    sites,
    ...(focusTime ? { focusTime, focusScores } : {}),
  };
}

export function snapshotScoreAtTime(
  snapshot: ObservationSnapshot | null | undefined,
  id: string,
): RecommendationScore | null {
  if (!snapshot) return null;
  return snapshot.focusTime
    ? snapshot.focusScores?.[id] ?? null
    : snapshot.sites?.[id]?.[0] ?? null;
}

export function recommendationLabel(band: RecommendationBand): string {
  return {
    priority: "优先",
    recommended: "推荐",
    watch: "观望",
    "not-recommended": "不推荐",
    unknown: "数据不足",
  }[band];
}

export function recommendationColor(band: RecommendationBand): string {
  return {
    priority: "#63e6e2",
    recommended: "#76d69b",
    watch: "#e8bb72",
    "not-recommended": "#e97979",
    unknown: "#526778",
  }[band];
}
