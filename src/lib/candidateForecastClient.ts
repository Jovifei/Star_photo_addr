import type { ForecastModel, LocationForecast } from "./types";
import { forecastAgeMs, FORECAST_FRESH_MS } from "./forecastIntegrity";
import { requestForecastResponse } from "./forecastClient";

type Coordinates = { latitude: number; longitude: number };
const MAX_ACTIVE = 2;
const MAX_ENTRIES = 128;
const MAX_PENDING = 64;
const FAILURE_COOLDOWN_MS = 60_000;
const entries = new Map<string, { promise: Promise<LocationForecast>; expiresAt: number; settled: boolean; refreshRevision: number; failed: boolean }>();
const pending: Array<() => void> = [];
let active = 0;

function schedule<T>(operation: () => Promise<T>): Promise<T> {
  if (pending.length >= MAX_PENDING) return Promise.reject(new Error("候选天气队列已满，请稍后手动刷新"));
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active += 1;
      void operation().then(resolve, reject).finally(() => {
        active -= 1;
        pending.shift()?.();
      });
    };
    if (active < MAX_ACTIVE) start();
    else pending.push(start);
  });
}

function normalizedDays(days: number, model: ForecastModel): number {
  const maximum = { icon: 8, gfs: 16, aifs: 15, best_match: 16 }[model];
  return Math.max(1, Math.min(maximum, Number.isFinite(days) ? Math.floor(days) : 14));
}

export function candidateForecastKey(location: Coordinates, model: ForecastModel, days = 14): string {
  const { latitude, longitude } = location;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("无效的候选坐标");
  return `${model}|${normalizedDays(days, model)}|${Number(latitude.toFixed(6))}|${Number(longitude.toFixed(6))}`;
}

/** Session-wide single flight, bounded concurrency and negative cache; no automatic retry. */
export function requestCandidateForecast(location: Coordinates, model: ForecastModel, days = 14, refreshRevision = 0): Promise<LocationForecast> {
  const key = candidateForecastKey(location, model, days);
  const previous = entries.get(key);
  if (previous && (!previous.settled || (previous.expiresAt > Date.now() && (previous.failed || refreshRevision <= previous.refreshRevision)))) return previous.promise;
  for (const [oldKey, entry] of entries) {
    if (entry.settled && (entry.expiresAt <= Date.now() || entries.size >= MAX_ENTRIES)) entries.delete(oldKey);
  }
  if (entries.size >= MAX_ENTRIES) return Promise.reject(new Error("候选天气请求过多，请稍后重试"));
  const entry = { promise: Promise.resolve(null as unknown as LocationForecast), expiresAt: Infinity, settled: false, refreshRevision, failed: false };
  entry.promise = schedule(async () => {
    const result = await requestForecastResponse([location], model, normalizedDays(days, model), refreshRevision > 0);
    const forecast = result.data.locations[0];
    if (!forecast) throw new Error("候选天气响应地点数量不符");
    const fetchedAge = forecastAgeMs(forecast);
    const stale = result.stale || fetchedAge > FORECAST_FRESH_MS;
    const normalized = { ...forecast, metadata: { ...forecast.metadata!, stale } };
    entry.failed = stale;
    entry.expiresAt = Date.now() + (stale ? FAILURE_COOLDOWN_MS : Math.min(FORECAST_FRESH_MS, Math.max(0, FORECAST_FRESH_MS - fetchedAge)));
    return normalized;
  }).catch((error: unknown) => {
    entry.failed = true;
    entry.expiresAt = Date.now() + FAILURE_COOLDOWN_MS;
    throw error;
  }).finally(() => { entry.settled = true; });
  entries.set(key, entry);
  return entry.promise;
}
