// Server-only Open-Meteo forecast proxy logic.

import type {
  ForecastMetadata,
  ForecastModel,
  ForecastResponse,
  ForecastProvenance,
  HourWeather,
  Location,
  LocationForecast,
} from "./types.ts";
import { withOpenMeteoProviderSlot, noteOpenMeteoRateLimit, OpenMeteoRateLimitError } from "./openMeteoRateLimit";
export { withOpenMeteoProviderSlot, noteOpenMeteoRateLimit, OpenMeteoRateLimitError, openMeteoCooldownRemainingMs } from "./openMeteoRateLimit";

interface RawHourly {
  time: string[];
  temperature_2m?: (number | null)[];
  relative_humidity_2m?: (number | null)[];
  dew_point_2m?: (number | null)[];
  precipitation_probability?: (number | null)[];
  precipitation?: (number | null)[];
  weather_code?: (number | null)[];
  cloud_cover?: (number | null)[];
  cloud_cover_low?: (number | null)[];
  cloud_cover_mid?: (number | null)[];
  cloud_cover_high?: (number | null)[];
  visibility?: (number | null)[];
  wind_speed_10m?: (number | null)[];
  wind_gusts_10m?: (number | null)[];
  wind_direction_10m?: (number | null)[];
  [key: string]: unknown;
}

interface RawForecastResponse {
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
  utc_offset_seconds?: number;
  hourly?: RawHourly;
}

export const OPEN_METEO_FORECAST_URL =
  process.env.OPEN_METEO_FORECAST_URL?.trim() ||
  "https://api.open-meteo.com/v1/forecast";

/** Use an authorized key with its matching customer endpoint; a key alone does not reset anonymous quotas. */
export function applyOpenMeteoApiKey(params: URLSearchParams): void {
  const key = process.env.OPEN_METEO_API_KEY?.trim();
  if (key) params.set("apikey", key);
}

const SURFACE_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
];

const REQUIRED_CLOUD_SERIES = [
  ["cloud_cover", "总云量"],
  ["cloud_cover_low", "低云"],
  ["cloud_cover_mid", "中云"],
  ["cloud_cover_high", "高云"],
] as const;

const MODEL_PARAMETERS: Record<ForecastModel, string | null> = {
  best_match: null,
  icon: "icon_seamless",
  gfs: "gfs_seamless",
  aifs: "ecmwf_aifs025_single",
};

/** Provider horizons used to prevent invalid `forecast_days` requests. */
export const FORECAST_MODEL_MAX_DAYS: Readonly<Record<ForecastModel, number>> =
  Object.freeze({
    best_match: 16,
    icon: 8,
    gfs: 16,
    aifs: 15,
  });

const FORECAST_UNITS: Record<string, string> = {
  temperature: "°C",
  dewPoint: "°C",
  cloudCover: "%",
  precipitation: "mm",
  visibility: "m",
  windSpeed: "m/s",
  windDirection: "°",
};

export function openMeteoModelParameter(model: ForecastModel): string | null {
  return MODEL_PARAMETERS[model];
}

export function maxForecastDaysForModel(model: ForecastModel): number {
  return FORECAST_MODEL_MAX_DAYS[model];
}

export function clampForecastDays(
  days: number,
  model: ForecastModel = "best_match",
): number {
  const normalized = Number.isFinite(days) ? Math.floor(days) : 1;
  return Math.min(maxForecastDaysForModel(model), Math.max(1, normalized));
}

export function buildForecastUrl(
  locations: Location[],
  days: number,
  model: ForecastModel = "best_match",
): string {
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    hourly: SURFACE_VARIABLES.join(","),
    timezone: "auto",
    forecast_days: String(clampForecastDays(days, model)),
    wind_speed_unit: "ms",
  });
  const providerModel = MODEL_PARAMETERS[model];
  if (providerModel) params.set("models", providerModel);
  applyOpenMeteoApiKey(params);
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

function validAlignedSeries(
  values: unknown,
  expectedLength: number,
): boolean {
  return (
    Array.isArray(values) &&
    values.length === expectedLength &&
    values.every(
      (value) =>
        value === null ||
        (typeof value === "number" && Number.isFinite(value)),
    ) &&
    values.some(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  );
}

export function validateRawForecast(
  item: RawForecastResponse | undefined,
): void {
  if (
    !item ||
    !Number.isFinite(item.latitude) ||
    !Number.isFinite(item.longitude) ||
    Math.abs(item.latitude) > 90 ||
    Math.abs(item.longitude) > 180 ||
    !Number.isFinite(item.elevation) ||
    typeof item.timezone !== "string" ||
    (item.utc_offset_seconds !== undefined &&
      !Number.isFinite(item.utc_offset_seconds)) ||
    !Array.isArray(item.hourly?.time)
  ) {
    throw new Error("天气上游返回了无法识别的 hourly 数据");
  }
  const times = item.hourly.time;
  if (times.length === 0) {
    throw new Error("天气上游没有返回逐小时数据");
  }
  if (
    !times.every(
      (time) =>
        typeof time === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time),
    )
  ) {
    throw new Error("天气上游返回了无效逐小时时间轴");
  }
  if (new Set(times).size !== times.length) {
    throw new Error("天气上游返回了重复逐小时时间轴");
  }
  for (const [field, label] of REQUIRED_CLOUD_SERIES) {
    if (!validAlignedSeries(item.hourly[field], times.length)) {
      throw new Error(`天气上游没有返回有效${label}数据`);
    }
  }
}

// Provider admission/cooldown is shared with Finder and health probes.

function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = Math.PI / 180;
  const dLat = (latitudeB - latitudeA) * radians;
  const dLon = (longitudeB - longitudeA) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latitudeA * radians) *
      Math.cos(latitudeB * radians) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6_371 * Math.asin(Math.sqrt(a));
}

async function providerError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as
    | { reason?: string }
    | null;
  const detail = body?.reason?.trim();
  if (detail) {
    console.warn(
      `[forecast] Open-Meteo HTTP ${response.status}: ${detail.slice(0, 180)}`,
    );
  }
  return new Error(`天气接口返回 HTTP ${response.status}`);
}

async function requestJson(
  url: string,
  signal?: AbortSignal,
): Promise<RawForecastResponse | RawForecastResponse[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await withOpenMeteoProviderSlot(() => fetch(url, {
        signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      }));
      if (response.ok) {
        const data = (await response.json()) as
          | RawForecastResponse
          | RawForecastResponse[];
        const forecasts = Array.isArray(data) ? data : [data];
        forecasts.forEach(validateRawForecast);
        return data;
      }
      lastError = await providerError(response);
      if (response.status === 429) {
        // Do not immediately retry a rate-limited request; the route-level
        // coordinator exposes Retry-After/cooldown to the caller instead.
        noteOpenMeteoRateLimit(response.headers.get("Retry-After"));
        break;
      }
      if (response.status < 500) break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (error instanceof OpenMeteoRateLimitError) break;
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("天气接口请求失败");
}

function normalizeHourly(response: RawForecastResponse): HourWeather[] {
  const hourly = response.hourly ?? { time: [] };
  return (hourly.time ?? []).map((time, index) => ({
    time,
    temperature: hourly.temperature_2m?.[index] ?? null,
    humidity: hourly.relative_humidity_2m?.[index] ?? null,
    dewPoint: hourly.dew_point_2m?.[index] ?? null,
    precipitationProbability:
      hourly.precipitation_probability?.[index] ?? null,
    precipitation: hourly.precipitation?.[index] ?? null,
    weatherCode: hourly.weather_code?.[index] ?? null,
    cloudCover: hourly.cloud_cover?.[index] ?? null,
    cloudLow: hourly.cloud_cover_low?.[index] ?? null,
    cloudMid: hourly.cloud_cover_mid?.[index] ?? null,
    cloudHigh: hourly.cloud_cover_high?.[index] ?? null,
    visibility: hourly.visibility?.[index] ?? null,
    windSpeed: hourly.wind_speed_10m?.[index] ?? null,
    windGust: hourly.wind_gusts_10m?.[index] ?? null,
    windDirection: hourly.wind_direction_10m?.[index] ?? null,
  }));
}

/** Convert an Open-Meteo local wall-clock time into the true UTC instant. */
export function parseProviderTime(
  localTime: string,
  utcOffsetSeconds: number,
): Date {
  const paddedTime = localTime.length === 16 ? `${localTime}:00` : localTime;
  const localAsUtcMillis = Date.parse(`${paddedTime}Z`);
  return new Date(localAsUtcMillis - utcOffsetSeconds * 1000);
}

export async function fetchSurfaceForecasts(
  locations: Location[],
  days = 14,
  signal?: AbortSignal,
  model: ForecastModel = "best_match",
): Promise<LocationForecast[]> {
  if (locations.length === 0) return [];
  const requestedDays = clampForecastDays(days, model);
  const data = await requestJson(
    buildForecastUrl(locations, requestedDays, model),
    signal,
  );
  const responses = Array.isArray(data) ? data : [data];
  if (responses.length !== locations.length) {
    throw new Error(
      `天气上游响应数量不匹配：请求 ${locations.length} 个地点，收到 ${responses.length} 个响应`,
    );
  }
  const fetchedAt = new Date().toISOString();
  const metadata: ForecastMetadata = {
    source: "Open-Meteo",
    model,
    fetchedAt,
    sourceFetchedAt: fetchedAt,
    providerRunAt: null,
    stale: false,
    units: FORECAST_UNITS,
  };
  return locations.map((location, index) => {
    const single = responses[index];
    if (!single) throw new Error("天气上游缺少对应地点的响应");
    const provenance: ForecastProvenance = {
      requestedLatitude: location.latitude,
      requestedLongitude: location.longitude,
      modelLatitude: single.latitude,
      modelLongitude: single.longitude,
      modelDistanceKm: distanceKm(
        location.latitude,
        location.longitude,
        single.latitude,
        single.longitude,
      ),
      modelElevation: single.elevation,
      elevationSource: "provider-dem",
      sourceFetchedAt: fetchedAt,
      providerRunAt: null,
      timezone: single.timezone,
      utcOffsetSeconds: single.utc_offset_seconds ?? 0,
    };
    return {
      locationId: location.id,
      modelLatitude: single.latitude,
      modelLongitude: single.longitude,
      modelElevation: single.elevation,
      timezone: single.timezone,
      utcOffsetSeconds: single.utc_offset_seconds ?? 0,
      fetchedAt,
      metadata,
      requestedLatitude: location.latitude,
      requestedLongitude: location.longitude,
      modelDistanceKm: distanceKm(
        location.latitude,
        location.longitude,
        single.latitude,
        single.longitude,
      ),
      elevationSource: "provider-dem",
      providerRunAt: null,
      provenance,
      hourly: normalizeHourly(single),
    };
  });
}

export async function fetchForecastByCoords(
  latitudes: number[],
  longitudes: number[],
  days: number,
  signal?: AbortSignal,
  model: ForecastModel = "best_match",
): Promise<ForecastResponse> {
  const locations: Location[] = latitudes.map((latitude, index) => ({
    id: `loc-${index}`,
    name: "",
    latitude,
    longitude: longitudes[index],
    elevation: 0,
    source: "搜索",
  }));
  const locationsData = await fetchSurfaceForecasts(
    locations,
    days,
    signal,
    model,
  );
  return { locations: locationsData, metadata: locationsData[0]?.metadata };
}
