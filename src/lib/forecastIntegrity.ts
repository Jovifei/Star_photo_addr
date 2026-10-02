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
    forecast.metadata ? dataAgeMs(forecast.metadata.fetchedAt, now) : Infinity,
    forecast.metadata?.sourceFetchedAt !== undefined
      ? dataAgeMs(forecast.metadata.sourceFetchedAt, now)
      : 0,
  );
}

export function forecastTrustIssue(
  forecast: LocationForecast | null | undefined,
  now = Date.now(),
  expectedModel?: ForecastModel,
): string | null {
  if (!forecast) return "暂无天气数据";
  if (!forecast.metadata || !forecast.metadata.model) return "天气数据缺少模型身份，不发布推荐分";
  if (expectedModel && forecast.metadata.model !== expectedModel) return "天气数据模型与当前选择不一致，不发布推荐分";
  if (forecast.metadata?.stale) return "天气数据已降级或过期，不发布推荐分";
  if (dataAgeMs(forecast.fetchedAt, now) > MAX_FORECAST_AGE_MS || forecastAgeMs(forecast, now) > MAX_FORECAST_AGE_MS) return "天气抓取时间缺失、异常或超过 6 小时，不发布推荐分";
  return null;
}

/** Disk files predate this contract; validate the decoded shape before returning it. */
export function usableDiskForecast(value: unknown, model: ForecastModel, count: number, maxAgeMs: number, now = Date.now()): value is ForecastResponse {
  if (!value || typeof value !== "object") return false;
  const data = value as ForecastResponse;
  if (!Array.isArray(data.locations) || data.locations.length !== count || !count) return false;
  const limit = Math.min(maxAgeMs, MAX_FORECAST_AGE_MS);
  if (!data.metadata || data.metadata.model !== model || data.metadata.stale || dataAgeMs(data.metadata.fetchedAt, now) > limit) return false;
  return data.locations.every((location) => Boolean(
    location && location.metadata?.model === model &&
    Number.isFinite(location.modelLatitude) && Number.isFinite(location.modelLongitude) &&
    Array.isArray(location.hourly) && location.hourly.length > 0 &&
    new Set(location.hourly.map((hour) => hour?.time)).size === location.hourly.length &&
    location.hourly.every((hour) => hour && typeof hour.time === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(hour.time)) &&
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
    ["temperature", "温度", -100, 70], ["humidity", "湿度", 0, 100],
    ["dewPoint", "露点", -120, 70], ["precipitationProbability", "降水概率", 0, 100],
    ["precipitation", "降水量", 0, Infinity], ["windSpeed", "风速", 0, Infinity],
    ["windGust", "阵风", 0, Infinity], ["visibility", "能见度", 0, Infinity],
    ["weatherCode", "天气代码", 0, 99],
  ];
  return fields.filter(([field, , min, max]) => !within(hour[field], min, max)).map(([, label]) => label);
}

export function missingNightInputs(hour: HourWeather): string[] {
  return missingWeatherInputs(hour);
}

/** Conservative scoring input only. Cloud layers overlap: this is NOT a new measured total or a sum. */
export function effectiveCloudForScore(hour: HourWeather): number | null {
  const values = [hour.cloudCover, hour.cloudLow, hour.cloudMid, hour.cloudHigh];
  if (!values.every((value) => within(value, 0, 100))) return null;
  return Math.max(...values as number[]);
}

export interface CoreWeatherScore {
  clearSky: number;
  precipitation: number;
  transparency: number;
  wind: number;
  weatherRisk: number;
  weatherScore: number;
  effectiveCloudForScore: number;
  blockers: string[];
}

const scoreClamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));
const scoreScale = (value: number, low: number, high: number): number =>
  scoreClamp(((value - low) / (high - low)) * 100);

/** Shared weather-only score used by the map hour and the astronomy scorer. */
export function scoreCoreWeather(hour: HourWeather): CoreWeatherScore | null {
  if (missingWeatherInputs(hour).length) return null;
  const effectiveCloud = effectiveCloudForScore(hour);
  if (effectiveCloud === null) return null;
  const precipitationProbability = hour.precipitationProbability;
  if (!within(precipitationProbability, 0, 100)) return null;
  const clearSky = 100 - effectiveCloud;
  const precipitation = scoreClamp(
    100 - Math.max(
      precipitationProbability,
      Math.min(100, hour.precipitation! * 160),
    ),
  );
  const transparency = scoreScale(hour.visibility!, 3_000, 30_000);
  const wind = scoreClamp(
    100 - scoreScale(hour.windSpeed!, 3, 12) * 0.65 - scoreScale(hour.windGust!, 6, 18) * 0.35,
  );
  const weatherRisk = scoreClamp(
    precipitation * 0.5 + transparency * 0.2 + wind * 0.3,
  );
  const blockers = [
    ...(hour.weatherCode! >= 95 ? ["雷暴风险"] : []),
    ...(hour.precipitation! >= 0.2 || precipitationProbability >= 70 ? ["降水风险"] : []),
    ...(hour.visibility! < 3_000 ? ["能见度过低"] : []),
    ...(hour.windGust! >= 15 ? ["阵风过大"] : []),
    ...(effectiveCloud >= 50 ? ["总云或分层云覆盖偏高"] : []),
  ];
  return {
    clearSky,
    precipitation,
    transparency,
    wind,
    weatherRisk: Math.round(weatherRisk),
    weatherScore: Math.round(clearSky * 0.55 + precipitation * 0.2 + transparency * 0.1 + wind * 0.15),
    effectiveCloudForScore: effectiveCloud,
    blockers,
  };
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
