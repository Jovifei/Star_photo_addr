// localStorage forecast / custom-location cache (ported from star-weather's
// cache.js, renamed keys per the new design).
//
// Browser-only. All access is guarded so server rendering never touches
// localStorage.

import {
  FORECAST_CACHE_KEY,
  FORECAST_CACHE_MAX_AGE_MS,
  LOCATIONS_CACHE_KEY,
} from "./constants";
import type { LocationForecast, Location } from "./types";

interface ForecastCacheValue {
  savedAt: string;
  forecasts: LocationForecast[];
  stale: boolean;
}

export function readForecastCache(): ForecastCacheValue | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(
      window.localStorage.getItem(FORECAST_CACHE_KEY) ?? "null",
    );
    if (!value?.savedAt || !Array.isArray(value.forecasts)) return null;
    return {
      ...value,
      stale:
        Date.now() - new Date(value.savedAt).getTime() >
        FORECAST_CACHE_MAX_AGE_MS,
    };
  } catch {
    return null;
  }
}

export function writeForecastCache(
  forecasts: LocationForecast[],
): { savedAt: string; forecasts: LocationForecast[]; stale: boolean } {
  const value = { savedAt: new Date().toISOString(), forecasts };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify(value));
  }
  return { ...value, stale: false };
}

export function readCustomLocations(): Location[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(
      window.localStorage.getItem(LOCATIONS_CACHE_KEY) ?? "[]",
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeCustomLocations(locations: Location[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCATIONS_CACHE_KEY, JSON.stringify(locations));
}
