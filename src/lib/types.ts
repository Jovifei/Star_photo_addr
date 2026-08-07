// Shared TypeScript interfaces for the Perseids clone.
// These act as the single source of truth for JSON shapes exchanged
// between the client, the server route handlers, and the scoring engine.

/** A geographic location the user is inspecting or has selected. */
export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  /** Metres above sea level. User elevation is never silently overwritten by the model. */
  elevation: number;
  /** IANA timezone, filled in by the forecast proxy via `timezone=auto`. */
  timezone?: string;
  source: "参考点位" | "自定义" | "modeled" | "搜索";
  /** Optional pre-computed Bortle estimate (e.g. from cities.json). */
  bortle?: number;
}

/** Result of sampling the night-sky brightness at a coordinate. */
export interface DarkSkySample {
  latitude: number;
  longitude: number;
  /** 14..22 mag/arcsec²; null = nodata / unknown. */
  mpsas: number | null;
  /** 1..9 (falls back to 9 with `uncertain=true` when mpsas is null). */
  bortle: number;
  bortleName: string;
  source: "viirs-2024" | "world-atlas-2015" | "none";
  /** True for non-China samples (encoding unknown) or failed tile reads. */
  uncertain?: boolean;
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
  temperature?: number;
  humidity?: number;
  dewPoint?: number;
  precipitationProbability?: number;
  precipitation?: number;
  weatherCode?: number;
  cloudCover?: number;
  cloudLow?: number;
  cloudMid?: number;
  cloudHigh?: number;
  visibility?: number;
  windSpeed?: number;
  windGust?: number;
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
  hourly: HourWeather[];
}

export interface ForecastResponse {
  locations: LocationForecast[];
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

/** Cloud-control interactive state (Phase 1 simplified rendering). */
export interface CloudState {
  enabled: boolean;
  model: "icon" | "gfs" | "aifs";
  variable: "total" | "low" | "mid" | "high";
  timeIndex: number;
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
