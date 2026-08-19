// Server-only Open-Meteo geocoding proxy logic.

import type { GeocodeResponse, GeocodeResult } from "./types";

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

interface RawGeocodingResponse {
  results?: RawGeocodeResult[];
}

export const OPEN_METEO_GEOCODE_URL =
  process.env.OPEN_METEO_GEOCODE_URL?.trim() ||
  "https://geocoding-api.open-meteo.com/v1/search";

export function normalizeGeocodeResults(
  rawResults: RawGeocodeResult[] | undefined,
): GeocodeResult[] {
  return (rawResults ?? [])
    .filter(
      (raw) =>
        typeof raw.name === "string" &&
        raw.name.trim().length > 0 &&
        typeof raw.latitude === "number" &&
        Number.isFinite(raw.latitude) &&
        raw.latitude >= -90 &&
        raw.latitude <= 90 &&
        typeof raw.longitude === "number" &&
        Number.isFinite(raw.longitude) &&
        raw.longitude >= -180 &&
        raw.longitude <= 180,
    )
    .map((raw, index) => ({
      id: raw.id ?? -(index + 1),
      name: raw.name!.trim(),
      latitude: raw.latitude!,
      longitude: raw.longitude!,
      elevation:
        typeof raw.elevation === "number" && Number.isFinite(raw.elevation)
          ? raw.elevation
          : undefined,
      country: raw.country,
      admin1: raw.admin1,
      timezone: raw.timezone,
      featureCode: raw.feature_code,
    }));
}

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
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(
        `${OPEN_METEO_GEOCODE_URL}?${params.toString()}`,
        {
          signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        },
      );
      if (!response.ok) {
        lastError = new Error(`地理编码接口返回 ${response.status}`);
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }
      const data = (await response.json()) as RawGeocodingResponse;
      return { results: normalizeGeocodeResults(data.results) };
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("地理编码请求失败");
}
