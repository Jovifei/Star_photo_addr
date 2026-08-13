// Server-only Open-Meteo forecast proxy logic.

import type {
  ForecastMetadata,
  ForecastModel,
  ForecastResponse,
  HourWeather,
  Location,
  LocationForecast,
} from "./types.ts";

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

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

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

const MODEL_PARAMETERS: Record<ForecastModel, string | null> = {
  best_match: null,
  icon: "icon_seamless",
  gfs: "gfs_seamless",
  aifs: "ecmwf_aifs025",
};

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
    forecast_days: String(Math.min(16, Math.max(1, days))),
    wind_speed_unit: "ms",
  });
  const providerModel = MODEL_PARAMETERS[model];
  if (providerModel) params.set("models", providerModel);
  return `${FORECAST_URL}?${params.toString()}`;
}

async function requestJson(
  url: string,
  signal?: AbortSignal,
): Promise<RawForecastResponse | RawForecastResponse[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
      });
      if (response.ok) {
        const data = (await response.json()) as RawForecastResponse | RawForecastResponse[];
        const first = Array.isArray(data) ? data[0] : data;
        if (!first || !Array.isArray(first.hourly?.time)) {
          throw new Error("天气上游返回了无法识别的 hourly 数据");
        }
        return data;
      }
      lastError = new Error(`天气接口返回 ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("天气接口请求失败");
}

function normalizeHourly(response: RawForecastResponse): HourWeather[] {
  const hourly = response.hourly ?? { time: [] };
  return (hourly.time ?? []).map((time, index) => ({
    time,
    temperature: hourly.temperature_2m?.[index] ?? null,
    humidity: hourly.relative_humidity_2m?.[index] ?? null,
    dewPoint: hourly.dew_point_2m?.[index] ?? null,
    precipitationProbability: hourly.precipitation_probability?.[index] ?? null,
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
export function parseProviderTime(localTime: string, utcOffsetSeconds: number): Date {
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
  const data = await requestJson(buildForecastUrl(locations, days, model), signal);
  const responses = Array.isArray(data) ? data : [data];
  if (responses.length !== locations.length) {
    throw new Error(`天气上游响应数量不匹配：请求 ${locations.length} 个地点，收到 ${responses.length} 个响应`);
  }
  const fetchedAt = new Date().toISOString();
  const metadata: ForecastMetadata = {
    source: "Open-Meteo",
    model,
    fetchedAt,
    stale: false,
    units: FORECAST_UNITS,
  };
  return locations.map((location, index) => {
    const single = responses[index];
    if (!single) throw new Error("天气上游缺少对应地点的响应");
    return {
      locationId: location.id,
      modelLatitude: single.latitude,
      modelLongitude: single.longitude,
      modelElevation: single.elevation,
      timezone: single.timezone,
      utcOffsetSeconds: single.utc_offset_seconds ?? 0,
      fetchedAt,
      metadata,
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
  const locationsData = await fetchSurfaceForecasts(locations, days, signal, model);
  return { locations: locationsData, metadata: locationsData[0]?.metadata };
}
