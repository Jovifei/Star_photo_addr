import { FINDER_LOCATIONS } from "@/data/observingSites/catalog";
import type { FinderLocation, FinderMode, FinderWeatherRecord } from "@/lib/stargazingFinderTypes";
import type { ForecastModel, HourWeather, ObservationSnapshot, ObservingSite, RecommendationBand, RecommendationScore } from "@/lib/types";
import {
  dataAgeMs, MAX_FORECAST_AGE_MS,
  OBSERVATION_INTEGRITY_VERSION, sanitizeObservationSnapshot, observationSnapshotIssue, withholdRecommendation, type IntegritySnapshot,
} from "./forecastIntegrity";
import { scoreHour } from "./hourScore";

export const OBSERVING_SITE_COUNT = FINDER_LOCATIONS.length;
export const DEFAULT_RECOMMENDATION_THRESHOLD = 70;
export const MAX_SHORTLIST_SIZE = 20;

/** Catalog Bortle remains reference metadata for filtering/colour, never a live score input. */
export function finderLocationToObservingSite(location: FinderLocation): ObservingSite {
  return { id: location.id, name: location.name, province: location.province, area: location.area,
    latitude: location.latitude, longitude: location.longitude, altitude: location.elevation,
    bortle: location.bortle, description: location.reason };
}
export const OBSERVING_SITES: ObservingSite[] = FINDER_LOCATIONS.map(finderLocationToObservingSite);
export function observingSiteToLocation(site: ObservingSite) {
  return { id: site.id, name: site.name, latitude: site.latitude, longitude: site.longitude,
    elevation: site.altitude, source: "参考点位" as const, bortle: site.bortle,
    province: site.province, area: site.area, description: site.description };
}
function numberAt(values: Array<number | null> | undefined, index: number): number | null {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
function isNightHour(time: string, date: string): boolean {
  const hour = Number(time.slice(11, 13));
  return (time.startsWith(date) && hour >= 20) || (time.startsWith(addDays(date, 1)) && hour <= 5);
}
function formatWindow(times: string[]): string | null {
  return times.length ? `${times[0]?.slice(11, 16)}–${times.at(-1)?.slice(11, 16)}（${times.length} 个连续小时采样）` : null;
}
function bandFor(score: number, blocker: boolean): RecommendationBand {
  if (blocker) return "not-recommended";
  // Single-model completeness is not independent model agreement; no priority/guarantee tier.
  if (score >= 70) return "recommended";
  if (score >= 55) return "watch";
  return "not-recommended";
}
function unknownHourScore(site: ObservingSite, blockers: string[], scoreTime: string | null = null): RecommendationScore {
  void site.id;
  return { score: null, band: "unknown", cloud: null, darkness: null, weatherRisk: null,
    bestWindow: null, blockers, confidence: "unknown", validHours: 0,
    scoreBasis: "selected-forecast-hour", scoreTime, aggregation: "single-hour" };
}
function unknownNightScore(site: ObservingSite, blockers: string[]): RecommendationScore {
  return { ...unknownHourScore(site, blockers), scoreBasis: "night-weather-average", scoreTime: null, aggregation: "mean-hours" };
}
function recordIssue(record: FinderWeatherRecord | undefined, expectedModel?: ForecastModel): string | null {
  if (!record || record.status !== "available") return "天气过期、缺失或上游失败，不发布推荐分";
  if (expectedModel && record.model !== expectedModel) return "天气数据模型缺失或与当前选择不一致，不发布推荐分";
  if (dataAgeMs(record.fetchedAt) > MAX_FORECAST_AGE_MS) return "天气抓取时间缺失、异常或超过 6 小时";
  if (!Number.isFinite(record.utcOffsetSeconds ?? record.provenance?.utcOffsetSeconds)) return "天气数据缺少时区偏移，不发布推荐分";
  return null;
}
function weatherHour(record: FinderWeatherRecord, index: number): HourWeather {
  const hourly = record.hourly!;
  return { time: hourly.time[index]!, temperature: numberAt(hourly.temperature_2m, index), humidity: numberAt(hourly.relative_humidity_2m, index),
    dewPoint: numberAt(hourly.dew_point_2m, index), precipitationProbability: numberAt(hourly.precipitation_probability, index), cloudCover: numberAt(hourly.cloud_cover, index),
    cloudLow: numberAt(hourly.cloud_cover_low, index), cloudMid: numberAt(hourly.cloud_cover_mid, index),
    cloudHigh: numberAt(hourly.cloud_cover_high, index), precipitation: numberAt(hourly.precipitation, index),
    windSpeed: numberAt(hourly.wind_speed_10m, index), windGust: numberAt(hourly.wind_gusts_10m, index),
    visibility: numberAt(hourly.visibility, index), weatherCode: numberAt(hourly.weather_code, index) };
}
interface ClearWindowRow { time: string; cloud: number | null }
function wallClockMillis(time: string): number {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time) ? Date.parse(`${time}Z`) : NaN;
}
/** Never join hours across missing/cloudy rows or duplicate times. */
export function findBestContiguousWindow(rows: ClearWindowRow[], minimumHours = 3): string[] {
  if (minimumHours < 1) return [];
  const sorted = [...rows].filter((row) => Number.isFinite(wallClockMillis(row.time))).sort((a, b) => a.time.localeCompare(b.time));
  const groups: ClearWindowRow[][] = [];
  for (const row of sorted) {
    const group = groups.at(-1);
    const previous = group?.at(-1);
    if (!group || !previous || wallClockMillis(row.time) - wallClockMillis(previous.time) !== 3_600_000) groups.push([row]);
    else group.push(row);
  }
  const candidates = groups.flatMap((group) => group.length < minimumHours ? [] : Array.from({ length: group.length - minimumHours + 1 }, (_, index) => group.slice(index, index + minimumHours)));
  const average = (items: ClearWindowRow[]) => items.reduce((sum, item) => sum + (item.cloud ?? 100), 0) / items.length;
  candidates.sort((a, b) => average(a) - average(b) || a[0]!.time.localeCompare(b[0]!.time));
  return candidates[0]?.map((row) => row.time) ?? [];
}

/** Exact selected forecast hour, not a night-best score or an observation. */
export function scoreObservingSiteAtTime(
  site: ObservingSite,
  record: FinderWeatherRecord | undefined,
  time: string,
  expectedModel?: ForecastModel,
): RecommendationScore {
  const issue = recordIssue(record, expectedModel);
  if (issue) return unknownHourScore(site, [issue]);
  const hourly = record?.hourly;
  const index = hourly?.time?.indexOf(time) ?? -1;
  if (!hourly || index < 0 || hourly.time.lastIndexOf(time) !== index) return unknownHourScore(site, ["此时暂无唯一对应的天气时次"]);
  const hour = weatherHour(record!, index);
  const evaluation = scoreHour(
    hour,
    observingSiteToLocation(site),
    record!.utcOffsetSeconds ?? record!.provenance?.utcOffsetSeconds ?? 0,
  );
  if (!evaluation) return unknownHourScore(site, ["此时关键天气数据缺失或无效"], time);
  return {
    score: evaluation.score,
    band: bandFor(evaluation.score, evaluation.blockers.length > 0),
    cloud: evaluation.cloudCover ?? null,
    darkness: Math.round(evaluation.components.darkness),
    weatherRisk: evaluation.weatherRisk ?? null,
    bestWindow: null,
    blockers: evaluation.blockers,
    confidence: "medium",
    validHours: 1,
    cloudLow: evaluation.cloudLow ?? null,
    cloudMid: evaluation.cloudMid ?? null,
    cloudHigh: evaluation.cloudHigh ?? null,
    effectiveCloudForScore: evaluation.effectiveCloudForScore ?? null,
    scoreTime: time,
    scoreBasis: "selected-forecast-hour",
    aggregation: "single-hour",
    modelAgreement: "not-checked",
    fetchedAt: record!.fetchedAt,
  };
}

/** Night summary remains separate from the exact-hour view; missing hours cannot inflate it. */
export function scoreObservingSite(site: ObservingSite, record: FinderWeatherRecord | undefined, date: string, mode: FinderMode = "photo", expectedModel?: ForecastModel): RecommendationScore {
  const issue = recordIssue(record, expectedModel);
  if (issue) return unknownNightScore(site, [issue]);
  const times = record?.hourly?.time.filter((time) => isNightHour(time, date)) ?? [];
  if (times.length < 7 || new Set(times).size !== times.length) return unknownNightScore(site, ["夜间有效天气时次不足或重复"]);
  const rows = times.map((time) => ({ time, result: scoreObservingSiteAtTime(site, record, time, expectedModel) }));
  // Critical input gaps are not silently filled with sunny defaults or skipped as bad weather.
  if (rows.some(({ result }) => result.score === null)) return unknownNightScore(site, ["夜间关键天气字段不完整，不发布推荐分"]);
  const average = (select: (score: RecommendationScore) => number) => rows.reduce((sum, row) => sum + select(row.result), 0) / rows.length;
  const blockers = [...new Set(rows.flatMap(({ result }) => result.blockers))];
  const score = Math.round(average((result) => result.score!));
  const clearRows = rows.filter(({ result }) => !result.blockers.length && (result as RecommendationScore & { effectiveCloudForScore: number }).effectiveCloudForScore <= (mode === "visual" ? 60 : 50))
    .map(({ time, result }) => ({ time, cloud: (result as RecommendationScore & { effectiveCloudForScore: number }).effectiveCloudForScore }));
  return Object.assign({ score, band: bandFor(score, blockers.length > 0), cloud: Math.round(average((result) => result.cloud!)), darkness: null,
    weatherRisk: Math.round(average((result) => result.weatherRisk!)), bestWindow: formatWindow(findBestContiguousWindow(clearRows, 3)), blockers,
    confidence: "medium" as const, validHours: rows.length }, { scoreBasis: "night-weather-average" as const, scoreTime: null, aggregation: "mean-hours" as const, modelAgreement: "not-checked" as const, fetchedAt: record?.fetchedAt ?? null });
}

export function buildObservationSnapshot(date: string, days: 1 | 3 | 5 | 7, model: ForecastModel, weatherByDate: Record<string, Record<string, FinderWeatherRecord>>, focusTime?: string): ObservationSnapshot {
  const dates = Array.from({ length: days }, (_, index) => addDays(date, index));
  const sites = Object.fromEntries(OBSERVING_SITES.map((site) => [site.id, dates.map((night) => scoreObservingSite(site, weatherByDate[night]?.[site.id], night, "photo", model))]));
  const records = dates.flatMap((night) => OBSERVING_SITES.map((site) => weatherByDate[night]?.[site.id]));
  const validTimes = records.map((record) => record?.fetchedAt).filter((time): time is string => typeof time === "string" && Number.isFinite(dataAgeMs(time)));
  validTimes.sort((a, b) => Date.parse(a) - Date.parse(b));
  const snapshot: IntegritySnapshot = {
    date, days, model, generatedAt: new Date().toISOString(), sourceFetchedAt: validTimes[0] ?? "",
    integrityVersion: OBSERVATION_INTEGRITY_VERSION,
    source: "Open-Meteo Forecast API; single-model weather conditions, not on-site assurance; catalog only, excluded from live score",
    stale: records.some((record) => Boolean(recordIssue(record))), sites,
    ...(focusTime ? { focusTime, focusScores: Object.fromEntries(OBSERVING_SITES.map((site) => [site.id, scoreObservingSiteAtTime(site, weatherByDate[date]?.[site.id], focusTime, model)])) } : {}),
  };
  return sanitizeObservationSnapshot(snapshot);
}
export function snapshotScoreAtTime(snapshot: ObservationSnapshot | null | undefined, id: string): RecommendationScore | null {
  if (!snapshot) return null;
  const result = snapshot.focusTime ? snapshot.focusScores?.[id] ?? null : snapshot.sites?.[id]?.[0] ?? null;
  const issue = observationSnapshotIssue(snapshot);
  return result && issue ? withholdRecommendation(result, issue) : result;
}
export function recommendationLabel(band: RecommendationBand): string {
  return { priority: "优先", recommended: "推荐", watch: "观望", "not-recommended": "不推荐", unknown: "数据不足" }[band];
}
export function recommendationColor(band: RecommendationBand): string {
  return { priority: "#63e6e2", recommended: "#76d69b", watch: "#e8bb72", "not-recommended": "#e97979", unknown: "#526778" }[band];
}
