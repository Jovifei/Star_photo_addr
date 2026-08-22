import { normalizeLocationTexts } from "../../../lib/chineseText";

const CACHE_KEY = "perseids-forecast-v1";
const LOCATIONS_KEY = "perseids-locations-v1";
const MAX_AGE_MS = 60 * 60 * 1000;

export function readForecastCache() {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (!value?.savedAt || !Array.isArray(value.forecasts)) return null;
    const savedAtMs = new Date(value.savedAt).getTime();
    if (!Number.isFinite(savedAtMs)) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return {
      ...value,
      stale: Date.now() - savedAtMs > MAX_AGE_MS,
    };
  } catch {
    return null;
  }
}

export function writeForecastCache(forecasts) {
  const value = { savedAt: new Date().toISOString(), forecasts };
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(value));
    } catch {
      // The current response remains usable when persistence is unavailable.
    }
  }
  return { ...value, stale: false };
}

export function readCustomLocations() {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(LOCATIONS_KEY) ?? "[]");
    return Array.isArray(value) ? value.map(normalizeLocationTexts) : [];
  } catch {
    return [];
  }
}

export function writeCustomLocations(locations) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
  } catch {
    // Current in-memory locations remain usable when storage is blocked.
  }
}
