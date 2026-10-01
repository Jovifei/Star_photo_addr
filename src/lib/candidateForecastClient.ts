import type { ForecastModel, LocationForecast } from "./types";
import { forecastAgeMs, FORECAST_FRESH_MS } from "./forecastIntegrity";
import { requestForecastResponse } from "./forecastClient";

type Coordinates = { latitude: number; longitude: number };
export type CandidateForecastLocation = Coordinates & { id: string };
export type CandidateForecastResult = { id: string; forecast: LocationForecast };

const MAX_ACTIVE = 2;
const MAX_ENTRIES = 128;
const MAX_PENDING = 64;
const FAILURE_COOLDOWN_MS = 60_000;
const entries = new Map<string, {
  promise: Promise<CandidateForecastResult[]>;
  expiresAt: number;
  settled: boolean;
  refreshRevision: number;
  failed: boolean;
}>();
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

function validateLocation(location: Coordinates): void {
  if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude) ||
    Math.abs(location.latitude) > 90 || Math.abs(location.longitude) > 180) {
    throw new Error("无效的候选坐标");
  }
}

export function candidateForecastKey(location: Coordinates, model: ForecastModel, days = 14): string {
  validateLocation(location);
  return `${model}|${normalizedDays(days, model)}|${Number(location.latitude.toFixed(6))}|${Number(location.longitude.toFixed(6))}`;
}

function batchKey(locations: CandidateForecastLocation[], model: ForecastModel, days: number): string {
  return `${model}|${days}|${JSON.stringify(locations.map(({ id, latitude, longitude }) => ({
    id,
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  })))}`;
}

/** Session-wide single flight for a stable candidate batch; no automatic retry. */
export function requestCandidateForecastBatch(
  locations: CandidateForecastLocation[],
  model: ForecastModel,
  days = 14,
  refreshRevision = 0,
): Promise<CandidateForecastResult[]> {
  if (!locations.length) return Promise.resolve([]);
  const ordered = [...locations].sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(ordered.map(({ id }) => id)).size !== ordered.length) return Promise.reject(new Error("候选地点标识重复"));
  for (const location of ordered) validateLocation(location);

  const requestedDays = normalizedDays(days, model);
  const key = batchKey(ordered, model, requestedDays);
  const previous = entries.get(key);
  if (previous && (!previous.settled || (previous.expiresAt > Date.now() && (previous.failed || refreshRevision <= previous.refreshRevision)))) return previous.promise;
  for (const [oldKey, entry] of entries) {
    if (entry.settled && (entry.expiresAt <= Date.now() || entries.size >= MAX_ENTRIES)) entries.delete(oldKey);
  }
  if (entries.size >= MAX_ENTRIES) return Promise.reject(new Error("候选天气请求过多，请稍后重试"));

  const entry = {
    promise: Promise.resolve([] as CandidateForecastResult[]),
    expiresAt: Infinity,
    settled: false,
    refreshRevision,
    failed: false,
  };
  entry.promise = schedule(async () => {
    const result = await requestForecastResponse(ordered, model, requestedDays, refreshRevision > 0);
    if (result.data.locations.length !== ordered.length) throw new Error("候选天气响应地点数量不符");
    const forecasts = result.data.locations.map((forecast, index) => {
      if (!forecast || forecast.metadata?.model !== model) throw new Error("候选天气响应模型不匹配");
      const fetchedAge = forecastAgeMs(forecast);
      const stale = result.stale || forecast.metadata.stale || fetchedAge > FORECAST_FRESH_MS;
      return { id: ordered[index]!.id, forecast: { ...forecast, metadata: { ...forecast.metadata, stale } } };
    });
    const stale = forecasts.some(({ forecast }) => forecast.metadata?.stale === true);
    entry.failed = stale;
    const oldestAge = Math.max(...forecasts.map(({ forecast }) => forecastAgeMs(forecast)));
    entry.expiresAt = Date.now() + (stale
      ? FAILURE_COOLDOWN_MS
      : Math.min(FORECAST_FRESH_MS, Math.max(0, FORECAST_FRESH_MS - oldestAge)));
    return forecasts;
  }).catch((error: unknown) => {
    entry.failed = true;
    entry.expiresAt = Date.now() + FAILURE_COOLDOWN_MS;
    throw error;
  }).finally(() => { entry.settled = true; });
  entries.set(key, entry);
  return entry.promise;
}

/** Compatibility wrapper for a single candidate; the page hook uses batches. */
export function requestCandidateForecast(
  location: Coordinates,
  model: ForecastModel,
  days = 14,
  refreshRevision = 0,
): Promise<LocationForecast> {
  const id = `point:${Number(location.latitude.toFixed(6))}:${Number(location.longitude.toFixed(6))}`;
  return requestCandidateForecastBatch([{ ...location, id }], model, days, refreshRevision)
    .then((results) => {
      const forecast = results[0]?.forecast;
      if (!forecast) throw new Error("候选天气响应地点数量不符");
      return forecast;
    });
}
