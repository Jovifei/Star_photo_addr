import type { HourWeather, LocationForecast, ForecastModel, ForecastResponse, ObservationSnapshot, RecommendationScore } from "./types";

/** Retention is not freshness. Even a retained response cannot be scored if stale. */
export const MAX_FORECAST_AGE_MS = 6 * 60 * 60_000;
export const FORECAST_FRESH_MS = 10 * 60_000;
export const OBSERVATION_INTEGRITY_VERSION = "weather-integrity-v2";
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60_000;

/** Never substitute file mtime, client receive time or forecast valid time. */
export function dataAgeMs(timestamp: unknown, now = Date.now()): number {
  if (typeof timestamp !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)) return Infinity;
  const instant = Date.parse(timestamp);
  if (!Number.isFinite(instant) || instant > now + FUTURE_CLOCK_TOLERANCE_MS) return Infinity;
  return Math.max(0, now - instant);
}

export function forecastAgeMs(forecast: LocationForecast, now = Date.now()): number {
  return Math.max(
    dataAgeMs(forecast.fetchedAt, now),
    forecast.metadata ? dataAgeMs(forecast.metadata.fetchedAt, now) : 0,
  );
}

export function forecastTrustIssue(forecast: LocationForecast | null | undefined, now = Date.now()): string | null {
  if (!forecast) return "暂无天气数据";
  if (forecast.metadata?.stale) return "天气数据已降级或过期，不发布推荐分";
  if (forecastAgeMs(forecast, now) > MAX_FORECAST_AGE_MS) return "天气抓取时间缺失、异常或超过 6 小时，不发布推荐分";
  return null;
}

/** Disk files predate this contract; validate the decoded shape before returning it. */
export function usableDiskForecast(value: unknown, model: ForecastModel, count: number, maxAgeMs: number, now = Date.now()): value is ForecastResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as ForecastResponse;
  if (!Array.isArray(data.locations) || data.locations.length !== count || !count) return false;
  const limit = Math.min(maxAgeMs, MAX_FORECAST_AGE_MS);
  if (data.metadata && (data.metadata.model !== model || dataAgeMs(data.metadata.fetchedAt, now) > limit)) return false;
  return data.locations.every((location) => Boolean(
    location && location.metadata?.model === model &&
    Number.isFinite(location.modelLatitude) && Number.isFinite(location.modelLongitude) &&
    Array.isArray(location.hourly) && location.hourly.length > 0 &&
    location.hourly.every((hour) => hour && typeof hour.time === "string") &&
    forecastAgeMs(location, now) <= limit,
  ));
}

function within(value: unknown, min: number, max = Infinity): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

/** Same meteorological input gate for map and night scoring; missing is not clear. */
export function missingWeatherInputs(hour: HourWeather): string[] {
  const fields: Array<[keyof HourWeather, string, number, number]> = [
    ["cloudCover", "总云量", 0, 100], ["cloudLow", "低云", 0, 100],
    ["cloudMid", "中云", 0, 100], ["cloudHigh", "高云", 0, 100],
    ["precipitation", "降水量", 0, Infinity], ["windSpeed", "风速", 0, Infinity],
    ["windGust", "阵风", 0, Infinity], ["visibility", "能见度", 0, Infinity],
    ["weatherCode", "天气代码", 0, 99],
  ];
  return fields.filter(([field, , min, max]) => !within(hour[field], min, max)).map(([, label]) => label);
}

export function missingNightInputs(hour: HourWeather): string[] {
  return [
    ...missingWeatherInputs(hour),
    ...(!within(hour.temperature, -100, 70) ? ["温度"] : []),
    ...(!within(hour.humidity, 0, 100) ? ["湿度"] : []),
    ...(!within(hour.dewPoint, -120, 70) ? ["露点"] : []),
  ];
}

/** Conservative scoring input only. Cloud layers overlap: this is NOT a new measured total or a sum. */
export function effectiveCloudForScore(hour: HourWeather): number | null {
  const values = [hour.cloudCover, hour.cloudLow, hour.cloudMid, hour.cloudHigh];
  if (!values.every((value) => within(value, 0, 100))) return null;
  return Math.max(...values as number[]);
}

export function withholdRecommendation(score: RecommendationScore, reason: string): RecommendationScore {
  return {
    ...score, score: null, band: "unknown", darkness: null, weatherRisk: null,
    bestWindow: null, confidence: "unknown", validHours: 0,
    blockers: [...new Set([...score.blockers, reason])],
  };
}

export type IntegritySnapshot = ObservationSnapshot & { integrityVersion?: string; sourceFetchedAt?: string };

export function observationSnapshotIssue(snapshot: ObservationSnapshot, now = Date.now()): string | null {
  const tagged = snapshot as IntegritySnapshot;
  if (tagged.integrityVersion !== OBSERVATION_INTEGRITY_VERSION) return "旧版评分缓存未通过数据完整性门槛";
  if (snapshot.stale || Math.max(dataAgeMs(snapshot.generatedAt, now), dataAgeMs(tagged.sourceFetchedAt, now)) > MAX_FORECAST_AGE_MS) return "数据过期或批次不完整，不发布推荐分";
  return null;
}

/** Leave raw cloud values for diagnosis, but never publish a stale recommendation. */
export function sanitizeObservationSnapshot(snapshot: ObservationSnapshot, now = Date.now()): ObservationSnapshot {
  const reason = observationSnapshotIssue(snapshot, now);
  if (!reason) return snapshot;
  return {
    ...snapshot, stale: true,
    sites: Object.fromEntries(Object.entries(snapshot.sites).map(([id, scores]) => [id, scores.map((score) => withholdRecommendation(score, reason))])),
    ...(snapshot.focusScores ? { focusScores: Object.fromEntries(Object.entries(snapshot.focusScores).map(([id, score]) => [id, withholdRecommendation(score, reason)])) } : {}),
  };
}
