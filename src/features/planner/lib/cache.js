const CACHE_KEY = "star-weather-forecast-v1";
const LOCATIONS_KEY = "star-weather-locations-v1";
const MAX_AGE_MS = 60 * 60 * 1000;

export function readForecastCache() {
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null");
    if (!value?.savedAt || !Array.isArray(value.forecasts)) return null;
    return { ...value, stale: Date.now() - new Date(value.savedAt).getTime() > MAX_AGE_MS };
  } catch {
    return null;
  }
}

export function writeForecastCache(forecasts) {
  const value = { savedAt: new Date().toISOString(), forecasts };
  localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  return value;
}

export function readCustomLocations() {
  try {
    const value = JSON.parse(localStorage.getItem(LOCATIONS_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeCustomLocations(locations) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locations));
}
