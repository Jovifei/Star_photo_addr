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

/**
 * Configurable raster basemap. The former anonymous CARTO endpoint now paints
 * an "API KEY REQUIRED" watermark over every map. Until a controlled vector
 * basemap is introduced, the safe zero-config fallback is the standard OSM
 * raster with a client-side dark treatment and mandatory attribution.
 *
 * Production operators can override both values at build time. Do not point a
 * public deployment at a tile service unless its usage policy permits it.
 */
const configuredBasemapUrl =
  process.env.NEXT_PUBLIC_BASEMAP_TILE_URL?.trim() ?? "";
const configuredBasemapAttribution =
  process.env.NEXT_PUBLIC_BASEMAP_ATTRIBUTION?.trim() ?? "";

export const BASEMAP_USES_DEFAULT_OSM = configuredBasemapUrl.length === 0;
export const BASEMAP_TILE_URL =
  configuredBasemapUrl || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const BASEMAP_ATTRIBUTION =
  configuredBasemapAttribution ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
/**
 * Keep a non-empty subdomain value even when the URL has no `{s}` token.
 * React-Leaflet forwards explicit `undefined` and overwrites Leaflet's default;
 * Firefox/WebKit then throw while reading `options.subdomains.length`.
 * Leaflet simply ignores this option when the URL does not contain `{s}`.
 */
export const BASEMAP_SUBDOMAINS = "abcd";
export const BASEMAP_TILE_CLASS_NAME = BASEMAP_USES_DEFAULT_OSM
  ? "base-map-tile base-map-tile--darkened"
  : "base-map-tile";

/**
 * Tianditu cia_w (imagery annotation) tile URL template.
 * `{s}` is the subdomain (0-7), `{z}/{x}/{y}` are tile coords.
 * The `tk` token is injected at runtime from `NEXT_PUBLIC_TIANDITU_TOKEN`.
 * `cia_w` uses light-coloured text designed for dark/satellite basemaps.
 */
export const TIANDITU_CIA_W_URL =
  "https://t{s}.tianditu.gov.cn/cia_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cia&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=" +
  (process.env.NEXT_PUBLIC_TIANDITU_TOKEN ?? "");

export const TIANDITU_ATTRIBUTION =
  '&copy; <a href="https://www.tianditu.gov.cn">天地图</a>';

/** Cache keys (deliberately NOT the old `star-weather-*` keys). */
export const FORECAST_CACHE_KEY = "perseids-forecast-v1";
export const LOCATIONS_CACHE_KEY = "perseids-locations-v1";
export const FORECAST_CACHE_MAX_AGE_MS = 60 * 60 * 1000;

/** localStorage key for persisted selected location (v2, versioned). */
export const SELECTED_LOCATION_STORAGE_KEY = "perseids-selected-location-v2";
export const CUSTOM_CANDIDATES_STORAGE_KEY = "perseids-custom-candidates-v1";
export const OBSERVING_MAP_VIEW_STORAGE_KEY = "jovi-observing-map-view-v1";
export const OBSERVING_THRESHOLD_STORAGE_KEY = "jovi-observing-threshold-v1";
export const OBSERVING_BORTLE_LIMIT_STORAGE_KEY = "jovi-observing-bortle-limit-v1";
export const OBSERVING_BORTLE_LEVELS_STORAGE_KEY = "jovi-observing-bortle-levels-v1";
export const OBSERVING_RECOMMENDED_ONLY_STORAGE_KEY = "jovi-observing-recommended-only-v1";
export const OBSERVING_BANDS_STORAGE_KEY = "jovi-observing-recommendation-bands-v1";
export const FORECAST_THEME_STORAGE_KEY = "jovi-forecast-theme-v1";

/** Default interactive cloud state (single forecast channel + timeline).
 *  Cloud is ON by default: on load the map samples the current viewport and
 *  renders the coverage overlay immediately — no "select a location first" gate. */
export const DEFAULT_CLOUD_STATE: CloudState = {
  enabled: true,
  model: "icon",
  activeForecastTime: null,
  activeObservationTime: null,
  overlayMode: "satellite-cloud",
  cloudDisplayMode: "total",
  highEnabled: false,
  midEnabled: false,
  lowEnabled: false,
  timeIndex: 0,
  playing: false,
  windEnabled: true,
  precipitationEnabled: true,
  range: 7,
};

/** Cloud-coverage colour stops for Canvas IDW rendering (value 0-100 → colour). */
export const CLOUD_COLOR_STOPS: Array<{ value: number; color: string }> = [
  { value: 0, color: "rgba(0,0,0,0)" },
  { value: 20, color: "#79cfe2" },
  { value: 50, color: "#d4b273" },
  { value: 80, color: "#fc5a49" },
  { value: 100, color: "#cb7768" },
];
