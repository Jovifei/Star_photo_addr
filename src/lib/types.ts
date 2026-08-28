// Shared TypeScript interfaces for the Perseids clone.
// These act as the single source of truth for JSON shapes exchanged
// between the client, the server route handlers, and the scoring engine.

/** A geographic location the user is inspecting or has selected. */
export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Metres above sea level; null when the curated source has no verified value. User elevation is never silently overwritten by the model. */
  elevation: number | null;
  /** IANA timezone, filled in by the forecast proxy via `timezone=auto`. */
  timezone?: string;
  source: "参考点位" | "自定义" | "modeled" | "搜索";
  /** Optional pre-computed Bortle estimate (e.g. from cities.json). */
  bortle?: number;
  /** Finder metadata retained when a curated site crosses into the planner. */
  province?: string;
  area?: string;
  description?: string;
}

/**
 * Why a dark-sky sample does or does not carry a trustworthy value.
 * - `ok`                 : a real pixel was read and decoded.
 * - `nodata`             : the pixel exists but encodes nodata (value 0).
 * - `unsupported-region` : outside the China VIIRS grid; encoding unknown.
 * - `layer-unavailable`  : the local raster bundle is not installed at all.
 */
export type DarkSkyStatus =
  | "ok"
  | "nodata"
  | "unsupported-region"
  | "layer-unavailable";

/**
 * Result of sampling the night-sky brightness at a coordinate.
 *
 * IMPORTANT: `bortle`/`bortleName`/`mpsas` are `null` whenever `status !== "ok"`.
 * Nodata must never be presented as a trustworthy B9 / SQM reading — see
 * `docs/LIGHT_POLLUTION_DATA_DECISION.md` ("无数据、过期、质量差必须有独立状态，
 * 不能默认为『暗』").
 */
export interface DarkSkySample {
  latitude: number;
  longitude: number;
  /** 14..22 mag/arcsec²; null = nodata / unknown. Never fabricated. */
  mpsas: number | null;
  /** 1..9, or null when no trustworthy classification exists. */
  bortle: number | null;
  /** Class name, or null when `bortle` is null. */
  bortleName: string | null;
  source: "viirs-2024" | "world-atlas-2015" | "none";
  /** Discriminator explaining the absence of a value. */
  status: DarkSkyStatus;
  /** True whenever the sample must not be used as a trustworthy reading. */
  uncertain: boolean;
}

/** A single Bortle-equivalent class. */
export interface BortleClass {
  level: number;
  name: string;
  color: string;
  lowerBoundMpsas: number;
}

/** One normalised weather hour (location-local time, from Open-Meteo). */
export interface HourWeather {
  time: string;
  temperature?: number | null;
  humidity?: number | null;
  dewPoint?: number | null;
  precipitationProbability?: number | null;
  precipitation?: number | null;
  weatherCode?: number | null;
  cloudCover?: number | null;
  cloudLow?: number | null;
  cloudMid?: number | null;
  cloudHigh?: number | null;
  visibility?: number | null;
  windSpeed?: number | null;
  windGust?: number | null;
  windDirection?: number | null;
}

export type ForecastModel = "best_match" | "icon" | "gfs" | "aifs";

export type CloudDisplayMode = "total" | "high" | "mid" | "low";

export interface SatelliteFrame {
  time: string;
  observedAt: string;
  kind: "cloud" | "night-lights";
  layer: string;
  label: string;
  satellite: string;
  source: "NASA GIBS";
  tileTemplate: string;
  coverage: string;
  observed: true;
  isForecast: false;
  reference?: boolean;
}

/** Mutually exclusive map products. Observation and forecast are never mixed. */
export type CloudOverlayMode = "satellite-cloud" | "forecast-cloud" | "night-lights";

/** The three user-facing map products. Kept separate from the legacy overlay
 * values so old deep links remain readable while the new shell has a small,
 * stable interface. */
export type MapViewMode = "satellite" | "light-pollution" | "combined";

/**
 * Which question the shared map is answering right now. `tonight` exposes the
 * weather workspace (timeline, score time window); `sites` strips those and
 * foregrounds the static dark-sky baseline (Bortle library, VIIRS). Set from
 * the `panel=sites` URL handshake, not persisted.
 */
export type MapWorkspace = "tonight" | "sites";

/**
 * Prediction theme shared by all products: same night-observation data,
 * different scoring lens. `star` ranks astro visibility, `cloud` ranks
 * cloud-sea potential (low-cloud driven). Future themes (e.g. fire glow)
 * extend this union.
 */
export type ForecastTheme = "star" | "cloud";

export type BortleLevel = 1 | 2 | 3 | 4;

export type RecommendationBand =
  | "priority"
  | "recommended"
  | "watch"
  | "not-recommended"
  | "unknown";

export type RecommendationConfidence = "high" | "medium" | "low" | "unknown";

/** Normalized point used by both the map and the decision workspace. */
export interface ObservingSite {
  id: string;
  name: string;
  province: string;
  area: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  bortle: BortleLevel;
  description?: string;
}

export interface RecommendationScore {
  score: number | null;
  band: RecommendationBand;
  cloud: number | null;
  darkness: number | null;
  weatherRisk: number | null;
  bestWindow: string | null;
  blockers: string[];
  confidence: RecommendationConfidence;
  validHours: number;
}

export interface ObservationSnapshot {
  date: string;
  days: 1 | 3 | 5 | 7;
  model: ForecastModel;
  generatedAt: string;
  source: string;
  stale: boolean;
  sites: Record<string, RecommendationScore[]>;
  /** Optional score for the exact forecast hour selected on the map. */
  focusTime?: string;
  focusScores?: Record<string, RecommendationScore>;
}

export type CloudTimeDomain = "observation" | "forecast" | "reference";

/** One normalized map frame used by the forecast data card and overlays. */
export interface ForecastMapFrame {
  time: string;
  cloudCover: number | null;
  cloudHigh: number | null;
  cloudMid: number | null;
  cloudLow: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  model: Exclude<ForecastModel, "best_match">;
  source: "Open-Meteo";
  isForecast: true;
  units: Record<string, string>;
}

export type SourceAvailability = "available" | "degraded" | "unconfigured" | "not-installed" | "expired";

export interface SourceStatus {
  id: string;
  label: string;
  status: SourceAvailability;
  detail: string;
  updatedAt?: string;
}

export interface ForecastMetadata {
  source: "Open-Meteo";
  model: ForecastModel;
  fetchedAt: string;
  stale: boolean;
  units: Record<string, string>;
}

/** Server-normalised forecast for a single location. */
export interface LocationForecast {
  locationId: string;
  modelLatitude: number;
  modelLongitude: number;
  modelElevation: number;
  timezone: string;
  utcOffsetSeconds: number;
  fetchedAt: string;
  metadata?: ForecastMetadata;
  hourly: HourWeather[];
}

export interface ForecastResponse {
  locations: LocationForecast[];
  metadata?: ForecastMetadata;
}

/** A single geocoding suggestion (cropped Open-Meteo result). */
export interface GeocodeResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  country?: string;
  admin1?: string;
  timezone?: string;
  featureCode?: string;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
}

export type Quality = "excellent" | "candidate" | "poor" | "blocked";
export type NightStatus = "go" | "watch" | "no" | "trend";
export type ConfidenceKind = "high" | "medium" | "low" | "trend";

export interface ScoreComponents {
  clearSky: number;
  precipitation: number;
  transparency: number;
  wind: number;
  darkness: number;
  moonlight: number;
}

/** One hour after astronomy + weather scoring. */
export interface HourEvaluation extends HourWeather {
  sunAltitude: number;
  moonAltitude: number;
  moonIllumination: number;
  galacticAltitude: number;
  score: number;
  quality: Quality;
  blockers: string[];
  components: ScoreComponents;
}

export interface Confidence {
  level: string;
  kind: ConfidenceKind;
  reason: string;
}

/** Full night evaluation for a single location and night key. */
export interface NightEvaluation {
  nightKey: string;
  score: number;
  cloudSeaPotential: number;
  status: NightStatus;
  confidence: Confidence;
  hours: HourEvaluation[];
  window: HourEvaluation[];
  windowLabel: string;
  darkHours: number;
  galacticMax: number;
  moonIllumination: number;
  moonPhase: string;
  blockers: string[];
  reason: string;
  scoreModelVersion: string;
}

/** Cloud layer derived from a pressure-level profile. */
export interface CloudLayer {
  baseMsl: number;
  topMsl: number;
  baseAgl: number;
  topAgl: number;
  relation: "云上" | "云中" | "云下";
  confidence: "高" | "中" | "低";
  levels: PressureLevel[];
}

export interface PressureLevel {
  pressure: number;
  cloudCover?: number;
  humidity?: number;
  temperature?: number;
  heightMsl?: number;
}

/**
 * Cloud-control interactive state (Phase 2 — three-layer independent control).
 * The old `variable` single-select field has been replaced by three boolean
 * toggles (`highEnabled`/`midEnabled`/`lowEnabled`) and a `playing` flag for
 * the timeline auto-advance.
 */
export interface CloudState {
  /** Master switch (controls the entire cloud feature). */
  enabled: boolean;
  /** Forecast model. */
  model: Exclude<ForecastModel, "best_match">;
  /** Canonical local ISO time selected by the matrix/timeline. */
  activeForecastTime?: string | null;
  /** Real observed satellite frame time. Kept separate from forecast time. */
  activeObservationTime?: string | null;
  /** Mutually exclusive map raster mode. */
  overlayMode?: CloudOverlayMode;
  /** Forecast raster channel; total cloud is the safe default. */
  cloudDisplayMode: CloudDisplayMode;
  /** High-level cloud layer toggle. */
  highEnabled: boolean;
  /** Mid-level cloud layer toggle. */
  midEnabled: boolean;
  /** Low-level cloud layer toggle. */
  lowEnabled: boolean;
  /** Current timeline index (0 = 20:00 of the first night, 9 = 05:00; 10 ticks per night). */
  timeIndex: number;
  /** Whether the timeline is auto-playing. */
  playing: boolean;
  /** Optional forecast-only wind vector overlay. */
  windEnabled: boolean;
  /** Optional forecast-only precipitation overlay. */
  precipitationEnabled: boolean;
  /** How many nights the cloud timeline covers, starting at `selectedNight`. 1 = one night (default). */
  range: 1 | 5 | 7;
}

/** A pre-computed dark-sky candidate city (from cities.json). */
export interface CityCandidate {
  id: string;
  adcode: number;
  province: string;
  city: string;
  name: string;
  longitude: number;
  latitude: number;
  bortle: number;
  kind: string;
  note: string;
}

// ---------------------------------------------------------------------------
// v2 new types
// ---------------------------------------------------------------------------

/** A curated recommendation for stargazing (human-curated data source). */
export interface Recommendation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Elevation in metres. */
  elevation: number;
  /** Bortle scale 1-9. */
  bortle: number;
  /** Recommendation reason / community review summary. */
  reason: string;
  /** Best stargazing season (e.g. "夏季 6-8月"). */
  bestSeason: string;
  /** Province / region. */
  province: string;
  /** Optional: months when the galactic core is visible. */
  galaxyMonths?: string[];
}

/** A grid sampling point for spatial cloud coverage. */
export interface CloudGridSample {
  latitude: number;
  longitude: number;
}

/** Complete data from one grid sampling pass (all time ticks included). */
export interface CloudGridData {
  /** Sampling point coordinates. */
  samples: CloudGridSample[];
  /** Bounding rectangle of the sampling area (for dashed boundary rendering). */
  bounds: { north: number; south: number; east: number; west: number };
  /** Hourly forecast for each sampling point (one-to-one with `samples`). */
  forecasts: LocationForecast[];
  /** Night keys covered by `forecasts` (multi-night ranges supported). */
  nightKeys: string[];
  /** Data fetch timestamp. */
  fetchedAt: string;
  model?: ForecastModel;
  rows?: number;
  cols?: number;
}

/** Three-layer cloud coverage interpolation result at a single time tick. */
export interface CloudLayerValues {
  high: number; // 0-100
  mid: number; // 0-100
  low: number; // 0-100
}

/** Table cell: evaluation status for a location on a given night. */
export interface StarWindowCell {
  nightKey: string;
  /** Evaluation status. */
  status: NightStatus;
  /** Score 0-100. */
  score: number;
  /** Whether the forecast is still loading. */
  loading: boolean;
}

/** Table row: all night evaluations for one location. */
export interface StarWindowRow {
  location: Location;
  cells: Map<string, StarWindowCell>;
}

/** Table sort direction. */
export type SortDirection = "asc" | "desc";
