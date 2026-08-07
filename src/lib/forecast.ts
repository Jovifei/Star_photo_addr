// Server-only Open-Meteo forecast proxy logic.
//
// This module is imported exclusively by `src/app/api/forecast/route.ts` (a
// Route Handler). It must never be imported from a client component — that keeps
// the Open-Meteo domain out of the browser bundle and satisfies the
// "client only talks to same-origin /api/*" constraint.

import type {
  ForecastResponse,
  HourWeather,
  LocationForecast,
  Location,
} from "./types";

/** Raw hourly block as returned by Open-Meteo (arrays may contain nulls). */
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
}

/** Raw single-location Open-Meteo forecast response. */
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
];

function providerUrl(locations: Location[], days: number): string {
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    hourly: SURFACE_VARIABLES.join(","),
    timezone: "auto",
    forecast_days: String(Math.min(16, Math.max(1, days))),
    wind_speed_unit: "ms",
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

async function requestJson(
  url: string,
  signal?: AbortSignal,
): Promise<RawForecastResponse | RawForecastResponse[]> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`天气接口返回 ${response.status}`);
  }
  return response.json();
}

function normalizeHourly(response: RawForecastResponse): HourWeather[] {
  const hourly = response.hourly ?? { time: [] };
  const times: string[] = hourly.time ?? [];
  return times.map((time: string, index: number) => ({
    time,
    temperature: hourly.temperature_2m?.[index] ?? undefined,
    humidity: hourly.relative_humidity_2m?.[index] ?? undefined,
    dewPoint: hourly.dew_point_2m?.[index] ?? undefined,
    precipitationProbability: hourly.precipitation_probability?.[index] ?? undefined,
    precipitation: hourly.precipitation?.[index] ?? undefined,
    weatherCode: hourly.weather_code?.[index] ?? undefined,
    cloudCover: hourly.cloud_cover?.[index] ?? undefined,
    cloudLow: hourly.cloud_cover_low?.[index] ?? undefined,
    cloudMid: hourly.cloud_cover_mid?.[index] ?? undefined,
    cloudHigh: hourly.cloud_cover_high?.[index] ?? undefined,
    visibility: hourly.visibility?.[index] ?? undefined,
    windSpeed: hourly.wind_speed_10m?.[index] ?? undefined,
    windGust: hourly.wind_gusts_10m?.[index] ?? undefined,
  }));
}

/**
 * Fetch surface forecasts for one or more locations and normalise them.
 * Open-Meteo returns an array when multiple coordinates are requested and a
 * single object otherwise — we always normalise to `LocationForecast[]`.
 */
export async function fetchSurfaceForecasts(
  locations: Location[],
  days = 14,
  signal?: AbortSignal,
): Promise<LocationForecast[]> {
  if (locations.length === 0) return [];
  const data = await requestJson(providerUrl(locations, days), signal);
  const responses = Array.isArray(data) ? data : [data];
  return locations.map((location, index) => {
    const single = responses[index] ?? responses[0];
    return {
      locationId: location.id,
      modelLatitude: single.latitude,
      modelLongitude: single.longitude,
      modelElevation: single.elevation,
      timezone: single.timezone,
      utcOffsetSeconds: single.utc_offset_seconds ?? 0,
      fetchedAt: new Date().toISOString(),
      hourly: normalizeHourly(single),
    };
  });
}

/** Build a `ForecastResponse` from virtual (lat/lon only) locations. */
export async function fetchForecastByCoords(
  latitudes: number[],
  longitudes: number[],
  days: number,
  signal?: AbortSignal,
): Promise<ForecastResponse> {
  const locations: Location[] = latitudes.map((latitude, index) => ({
    id: `loc-${index}`,
    name: "",
    latitude,
    longitude: longitudes[index] ?? longitudes[0],
    elevation: 0,
    source: "搜索",
  }));
  const locationsData = await fetchSurfaceForecasts(locations, days, signal);
  return { locations: locationsData };
}
