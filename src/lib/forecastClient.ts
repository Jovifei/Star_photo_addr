import type { ForecastModel, ForecastResponse, LocationForecast } from "./types";
import { dataAgeMs, forecastAgeMs, FORECAST_FRESH_MS } from "./forecastIntegrity";

type Coordinates = { latitude: number; longitude: number };
export interface ForecastClientResult {
  data: ForecastResponse;
  stale: boolean;
}

const MAX_ENTRIES = 128;
const FAILURE_COOLDOWN_MS = 60_000;
const MAX_ACTIVE = 4;
const MAX_PENDING = 128;
const inFlight = new Map<string, Promise<ForecastClientResult>>();
const failedUntil = new Map<string, number>();
const pending: Array<() => void> = [];
let active = 0;
let globalCooldownUntil = 0;

function schedule<T>(operation: () => Promise<T>, allowDuringCooldown = false): Promise<T> {
  if (pending.length >= MAX_PENDING) return Promise.reject(new Error("天气请求队列已满，请稍后重试"));
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      if (!allowDuringCooldown && globalCooldownUntil > Date.now()) {
        reject(new Error(`天气上游限流冷却中，请 ${Math.ceil((globalCooldownUntil - Date.now()) / 1000)} 秒后重试`));
        pending.shift()?.();
        return;
      }
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

const MAX_DAYS: Record<ForecastModel, number> = {
  best_match: 16,
  icon: 8,
  gfs: 16,
  aifs: 15,
};

export function normalizeForecastDaysForModel(days: number, model: ForecastModel): number {
  return Math.max(1, Math.min(MAX_DAYS[model], Number.isFinite(days) ? Math.floor(days) : 14));
}

function normalizedCoordinate(value: number): string {
  return Number(value.toFixed(6)).toString();
}

export function forecastRequestKey(
  locations: Coordinates[],
  model: ForecastModel,
  days: number,
): string {
  return JSON.stringify({
    model,
    days: normalizeForecastDaysForModel(days, model),
    locations: locations.map((location) => [
      normalizedCoordinate(location.latitude),
      normalizedCoordinate(location.longitude),
    ]),
  });
}

function validateLocation(
  location: LocationForecast | undefined,
  model: ForecastModel,
): location is LocationForecast {
  return Boolean(
    location &&
      location.metadata?.model === model &&
      Number.isFinite(location.modelLatitude) &&
      Number.isFinite(location.modelLongitude) &&
      Number.isFinite(location.modelElevation) &&
      typeof location.timezone === "string" &&
      Number.isFinite(location.utcOffsetSeconds) &&
      typeof location.fetchedAt === "string" &&
      Array.isArray(location.hourly) &&
      location.hourly.length > 0 &&
      new Set(location.hourly.map((hour) => hour?.time)).size === location.hourly.length &&
      location.hourly.every((hour) => typeof hour?.time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(hour.time)),
  );
}

function normalizeResponse(
  body: ForecastResponse,
  response: Response,
  model: ForecastModel,
  requestedLocations: Coordinates[],
): ForecastClientResult {
  if (!Array.isArray(body?.locations) || body.locations.length !== requestedLocations.length) {
    throw new Error("天气响应地点数量不符");
  }
  if (!body.metadata || body.metadata.model !== model) {
    throw new Error("天气响应缺少匹配的模型身份");
  }
  if (!body.locations.every((location) => validateLocation(location, model))) {
    throw new Error("天气响应缺少完整的地点天气结构");
  }
  if (body.locations.some((location, index) =>
    (location.requestedLatitude !== undefined && Math.abs(location.requestedLatitude - requestedLocations[index]!.latitude) > 1e-5) ||
    (location.requestedLongitude !== undefined && Math.abs(location.requestedLongitude - requestedLocations[index]!.longitude) > 1e-5),
  )) {
    throw new Error("天气响应地点坐标映射不一致");
  }
  const headerStale = response.headers.get("X-Data-Stale") === "true";
  const stale =
    headerStale ||
    body.metadata.stale ||
    body.locations.some((location) => location.metadata?.stale === true) ||
    dataAgeMs(body.metadata.fetchedAt) > FORECAST_FRESH_MS ||
    body.locations.some((location) => forecastAgeMs(location) > FORECAST_FRESH_MS);
  const metadata = {
    ...body.metadata,
    stale,
    sourceFetchedAt: body.metadata.sourceFetchedAt ?? body.metadata.fetchedAt,
    providerRunAt: body.metadata.providerRunAt ?? null,
  };
  const locations = body.locations.map((location) => ({
    ...location,
    metadata: {
      ...metadata,
      ...(location.metadata ?? {}),
      model,
      stale: stale || location.metadata?.stale === true,
      sourceFetchedAt:
        location.metadata?.sourceFetchedAt ?? location.metadata?.fetchedAt ?? metadata.sourceFetchedAt,
      providerRunAt: location.providerRunAt ?? location.metadata?.providerRunAt ?? metadata.providerRunAt,
    },
  }));
  return { data: { ...body, metadata, locations }, stale };
}

function trimFailures(now: number): void {
  for (const [key, until] of failedUntil) {
    if (until <= now) failedUntil.delete(key);
  }
  while (inFlight.size > MAX_ENTRIES) {
    const oldest = inFlight.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    inFlight.delete(oldest);
  }
  while (failedUntil.size > MAX_ENTRIES) {
    const oldest = failedUntil.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    failedUntil.delete(oldest);
  }
}

/** One browser request per model/coordinate/day key; consumers never abort the shared fetch. */
export function requestForecastResponse(
  locations: Coordinates[],
  model: ForecastModel,
  days = 14,
  forceRefresh = false,
): Promise<ForecastClientResult> {
  if (!locations.length) return Promise.reject(new Error("天气请求没有地点"));
  if (locations.some((location) => !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude))) {
    return Promise.reject(new Error("天气请求坐标无效"));
  }
  const normalizedDays = normalizeForecastDaysForModel(days, model);
  const key = forecastRequestKey(locations, model, normalizedDays);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const now = Date.now();
  trimFailures(now);
  if (!forceRefresh && globalCooldownUntil > now) {
    return Promise.reject(new Error(`天气上游限流冷却中，请 ${Math.ceil((globalCooldownUntil - now) / 1000)} 秒后重试`));
  }
  if (!forceRefresh && (failedUntil.get(key) ?? 0) > now) {
    return Promise.reject(new Error("天气请求失败冷却中，请稍后重试"));
  }
  const params = new URLSearchParams({
    latitude: locations.map((location) => normalizedCoordinate(location.latitude)).join(","),
    longitude: locations.map((location) => normalizedCoordinate(location.longitude)).join(","),
    days: String(normalizedDays),
    model,
  });
  if (forceRefresh) params.set("refresh", "1");
  const promise = schedule(() => fetch(`/api/forecast?${params.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(35_000),
  }), forceRefresh)
    .then(async (response) => {
      const body = await response.json().catch(() => null) as ForecastResponse | null;
      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("Retry-After"));
          const delay = Number.isFinite(retryAfter) ? Math.max(1_000, Math.min(120_000, retryAfter * 1_000)) : FAILURE_COOLDOWN_MS;
          globalCooldownUntil = Math.max(globalCooldownUntil, Date.now() + delay);
        }
        throw new Error(`天气请求失败（HTTP ${response.status}）`);
      }
      return normalizeResponse(body as ForecastResponse, response, model, locations);
    })
    .catch((error: unknown) => {
      failedUntil.set(key, Date.now() + FAILURE_COOLDOWN_MS);
      throw error;
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });
  inFlight.set(key, promise);
  return promise;
}
