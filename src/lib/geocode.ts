// Server-only Open-Meteo geocoding proxy logic.
//
// Imported only by `src/app/api/geocode/route.ts`. No Tencent key is used —
// Open-Meteo geocoding is keyless and global. This keeps all external domains
// server-side and same-origin to the client.

import type { GeocodeResponse, GeocodeResult } from "./types";

/** Raw single geocoding result as returned by Open-Meteo geocoding. */
interface RawGeocodeResult {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  elevation?: number;
  country?: string;
  admin1?: string;
  timezone?: string;
  feature_code?: string;
}

/** Raw Open-Meteo geocoding response. */
interface RawGeocodingResponse {
  results?: RawGeocodeResult[];
}

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

export async function searchPlaces(
  query: string,
  count = 10,
  language = "zh",
  signal?: AbortSignal,
): Promise<GeocodeResponse> {
  const params = new URLSearchParams({
    name: query,
    count: String(Math.min(100, Math.max(1, count))),
    language,
    format: "json",
  });
  const response = await fetch(`${GEOCODE_URL}?${params.toString()}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`地理编码接口返回 ${response.status}`);
  }
  const data = (await response.json()) as RawGeocodingResponse;
  const results: GeocodeResult[] = (data.results ?? []).map((raw) => ({
    id: raw.id ?? 0,
    name: raw.name ?? "",
    latitude: raw.latitude ?? 0,
    longitude: raw.longitude ?? 0,
    elevation: raw.elevation,
    country: raw.country,
    admin1: raw.admin1,
    timezone: raw.timezone,
    featureCode: raw.feature_code,
  }));
  return { results };
}
