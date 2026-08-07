// Shared constants for the Perseids clone.
//
// IMPORTANT: this module must NOT contain any third-party API domain or key.
// All network endpoints live server-side in `forecast.ts` / `geocode.ts` and are
// only ever reached from the `/api/*` route handlers.

import type { CloudState } from "./types";

/** Peak of the 2026 Perseids, used by the headline countdown. */
export const METEOR_PEAK_ISO = "2026-08-13T12:00:00Z";

/** The 11 observation nights (evening-date keys), 2026-08-07 … 2026-08-17. */
export const METEOR_SHOWER_NIGHTS: string[] = [
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
  "2026-08-10",
  "2026-08-11",
  "2026-08-12",
  "2026-08-13",
  "2026-08-14",
  "2026-08-15",
  "2026-08-16",
  "2026-08-17",
];

/** Default night shown when the app opens (peak eve / "8月12日夜—13日黎明"). */
export const DEFAULT_NIGHT_KEY = "2026-08-12";

/** Local night window: 20:00 → next-day 05:00 (faithful to perseids, not 18–06). */
export const NIGHT_START = 20;
export const NIGHT_END = 5;

/** VIIRS value encoding (vnp46a4-2024.json): 0=nodata, 1..255 => 14 + (v-1)/254*8. */
export const MPSAS_MIN = 14;
export const MPSAS_MAX = 22;

/** Output bounds of the China VIIRS enhancement layer. */
export const CHINA_BOUNDS = {
  west: 72,
  south: 3,
  east: 136,
  north: 55,
};

/** Local asset bases (served from /public). */
export const VIIRS_VISUAL_BASE = "/images/perseids/data/vnp46a4/2024";
export const VIIRS_VALUE_BASE = "/images/perseids/data/vnp46a4/2024-values";
export const VIIRS_SAMPLE_BASE = "/images/perseids/tiles-sample";
export const WORLD_ATLAS_IMAGE = "/images/perseids/data/world-atlas-2015.webp";
export const CITY_CANDIDATES_URL = "/images/perseids/data/cities.json";
export const VIIRS_META_URL = "/images/perseids/data/vnp46a4-2024.json";

/** CARTO dark basemap (no API key, faithful to perseids). */
export const CARTO_DARK_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
export const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Cache keys (deliberately NOT the old `star-weather-*` keys). */
export const FORECAST_CACHE_KEY = "perseids-forecast-v1";
export const LOCATIONS_CACHE_KEY = "perseids-locations-v1";
export const FORECAST_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

/** Default interactive cloud state. */
export const DEFAULT_CLOUD_STATE: CloudState = {
  enabled: false,
  model: "icon",
  variable: "total",
  timeIndex: 0,
};
