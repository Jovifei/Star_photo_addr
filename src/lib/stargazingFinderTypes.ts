export type FinderMode = "photo" | "visual";
export type FinderLabelMode = "all" | "qualified" | "off";
export type FinderRating = "perfect" | "great" | "good" | "fair" | "poor" | "unknown";
export type FinderWeatherStatus = "available" | "stale" | "missing" | "error";

export interface FinderLocation {
  id: string;
  name: string;
  area: string;
  province: string;
  latitude: number;
  longitude: number;
  elevation: number | null;
  bortle: 1 | 2 | 3 | 4;
  cityCode: string;
  reason: string;
}

/** Adapter target shared by the map and the decision workspace. */
export type { ObservingSite } from "./types";

export interface FinderHourlyData {
  time: string[];
  weather_code: Array<number | null>;
  cloud_cover: Array<number | null>;
  cloud_cover_low: Array<number | null>;
  cloud_cover_mid: Array<number | null>;
  cloud_cover_high: Array<number | null>;
  precipitation: Array<number | null>;
  visibility: Array<number | null>;
  wind_speed_10m: Array<number | null>;
  wind_gusts_10m: Array<number | null>;
  temperature_2m: Array<number | null>;
}

export interface FinderWeatherRecord {
  hourly: FinderHourlyData | null;
  status: FinderWeatherStatus;
  fetchedAt?: string;
  error?: string;
}

export interface FinderWeatherResponse {
  date: string;
  fetchedAt: string;
  source: string;
  stale: boolean;
  data: Record<string, FinderWeatherRecord>;
}

export interface FinderHour {
  time: string;
  timeLabel: string;
  date: string;
  hour: number;
  code: number | null;
  type: string;
  cloudy: boolean;
  cloud: number | null;
  cloudLow: number | null;
  cloudMid: number | null;
  cloudHigh: number | null;
  precip: number | null;
  wind: number | null;
  gust: number | null;
}

export interface FinderAnalysis {
  nightHours: FinderHour[];
  preHours: FinderHour[];
  postHours: FinderHour[];
  nightCloudyCount: number;
  nightTotal: number;
  nightCloudyPct: number;
  nightAllClear: boolean;
  nightCloudyTimes: string;
  preCloudyCount: number;
  preAllClear: boolean;
  preCloudyTimes: string;
  postCloudyCount: number;
  postAllClear: boolean;
  postCloudyTimes: string;
  nightMaxWind: number | null;
  nightAvgWind: number | null;
  strongWindTimes: string;
  nightMaxGust: number | null;
  strongGustTimes: string;
  visualNightTotal: number;
  visualCloudyCount: number;
  visualCloudyPct: number;
  visualAllClear: boolean;
  visualCloudyTimes: string;
  mode: FinderMode;
}

export interface FinderEvaluation {
  analysis: FinderAnalysis | null;
  rating: FinderRating;
  score: number | null;
  ratingDetail: string;
  windWarning: { text: string; level: string } | null;
  windRisk: { text: string; level: string; maxWind: number } | null;
  altitudeWarning: { text: string; level: string; altitude: number } | null;
  hazardWarning: string;
}
