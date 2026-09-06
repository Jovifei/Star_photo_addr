// Cloud-sea (云海条件指数) scoring for mountain observing sites.
//
// Uses surface low/mid/high cloud cover, 2 m temperature/relative humidity,
// precipitation and 10 m wind against mountain summit elevations. Cloud
// base/top values remain explicit heuristics; this module does not claim a
// pressure-profile or inversion diagnosis.

import { CLOUD_SEA_SITES, type CloudSeaSite } from "@/lib/cloudseaSites";
import type { ForecastModel } from "@/lib/types";

export type CloudPosition = "above" | "in" | "below" | "clear" | "unknown";

export type CloudSeaProbabilityLevel =
  | "p20"
  | "p40"
  | "p60"
  | "p80"
  | "p90"
  | "p100";

export interface CloudSeaWindowScore {
  score: number | null;
  probabilityLevel: CloudSeaProbabilityLevel | null;
  probabilityLabel: string | null;
  cloudPosition: CloudPosition;
  positionLabel: string;
  cloudBaseM: number | null;
  cloudTopM: number | null;
  altitudeDiffM: number | null;
  lowCloud: number | null;
  midCloud: number | null;
  highCloud: number | null;
  humidity: number | null;
  windSpeed: number | null;
  peakTime: string | null;
  summary: string;
}

export interface CloudSeaSiteScore {
  morning: CloudSeaWindowScore;
  evening: CloudSeaWindowScore;
}

export interface CloudSeaSnapshot {
  date: string;
  model: ForecastModel;
  generatedAt: string;
  source: string;
  stale: boolean;
  refreshError?: string;
  sites: Record<string, CloudSeaSiteScore>;
}

export const CLOUD_SEA_EMPTY_WINDOW: CloudSeaWindowScore = {
  score: null,
  probabilityLevel: null,
  probabilityLabel: null,
  cloudPosition: "unknown",
  positionLabel: "数据不足",
  cloudBaseM: null,
  cloudTopM: null,
  altitudeDiffM: null,
  lowCloud: null,
  midCloud: null,
  highCloud: null,
  humidity: null,
  windSpeed: null,
  peakTime: null,
  summary: "该时段无可用预报数据。",
};

export function positionLabel(pos: CloudPosition): string {
  switch (pos) {
    case "above":
      return "云上海拔";
    case "in":
      return "云中大雾";
    case "below":
      return "云下阴天";
    case "clear":
      return "晴朗少云";
    default:
      return "数据不足";
  }
}

export function positionBadgeTone(pos: CloudPosition): "good" | "warn" | "bad" | "muted" {
  switch (pos) {
    case "above":
      return "good";
    case "in":
      return "bad";
    case "below":
      return "warn";
    case "clear":
      return "muted";
    default:
      return "muted";
  }
}

export function probabilityLevelFor(score: number | null): CloudSeaProbabilityLevel {
  if (score == null || score < 20) return "p20";
  if (score < 40) return "p40";
  if (score < 60) return "p60";
  if (score < 80) return "p80";
  if (score < 90) return "p90";
  return "p100";
}

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

export interface RawSiteHourly {
  time: string[];
  cloud_cover?: Array<number | null>;
  cloud_cover_low?: Array<number | null>;
  cloud_cover_mid?: Array<number | null>;
  cloud_cover_high?: Array<number | null>;
  temperature_2m?: Array<number | null>;
  relative_humidity_2m?: Array<number | null>;
  precipitation?: Array<number | null>;
  visibility?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
}

/**
 * Estimate a heuristic condensation/cloud-layer height from surface humidity,
 * temperature, wind and low-cloud coverage. This is not a provider pressure-
 * level cloud-base/cloud-top product and must remain labelled as an estimate.
 */
export function estimateCloudLayers(
  siteAltitude: number,
  lowCloudPct: number,
  tempC: number,
  windSpeedMs = 2.0,
  humidityPct = 75,
): { baseM: number; topM: number } {
  // Approximate valley floor elevation ASL.
  const valleyFloorM = Math.max(50, Math.round(siteAltitude * 0.35));

  // Heuristic LCL proxy. Estimate dew-point depression from the real provider
  // relative humidity, then use ~125 m/°C as an approximate LCL height.
  const humidity = clamp(humidityPct, 5, 100);
  const dewPointC = tempC - (100 - humidity) / 5;
  const lclAboveValley = Math.round(
    clamp(125 * Math.max(0, tempC - dewPointC) + windSpeedMs * 10, 120, 1800),
  );
  const baseM = valleyFloorM + lclAboveValley;

  // Cloud thickness expands with low-cloud coverage. This is an engineering
  // heuristic for the Beta index, not a measured cloud-layer thickness.
  const thicknessM = Math.round(250 + (clamp(lowCloudPct) / 100) * 850);
  const topM = baseM + thicknessM;

  return { baseM, topM };
}

interface CloudSeaConditions {
  lowCloud: number;
  midCloud: number;
  highCloud: number;
  tempC: number;
  humidity: number;
  windSpeed: number;
  precip: number;
}

interface CloudSeaConditionEvaluation {
  score: number;
  position: CloudPosition;
  baseM: number;
  topM: number;
  altitudeDiffM: number;
  summary: string;
}

function evaluateConditions(
  site: CloudSeaSite,
  conditions: CloudSeaConditions,
): CloudSeaConditionEvaluation {
  const {
    lowCloud,
    midCloud,
    highCloud,
    tempC,
    humidity,
    windSpeed,
    precip,
  } = conditions;
  const { baseM, topM } = estimateCloudLayers(
    site.altitude,
    lowCloud,
    tempC,
    windSpeed,
    humidity,
  );
  const altitudeDiffM = site.altitude - topM;

  let position: CloudPosition = "clear";
  if (lowCloud < 25) {
    position = "clear";
  } else if (site.altitude >= topM + 30) {
    position = "above";
  } else if (site.altitude >= baseM - 50) {
    position = "in";
  } else {
    position = "below";
  }

  let score = 0;
  let summary = "";

  if (position === "above") {
    let baseScore = 65;
    if (lowCloud >= 75) baseScore += 18;
    else if (lowCloud >= 50) baseScore += 12;
    else baseScore += 5;

    if (windSpeed < 2.0) baseScore += 10;
    else if (windSpeed < 3.5) baseScore += 5;
    else if (windSpeed > 6.0) baseScore -= 12;

    const upperClouds = Math.max(midCloud, highCloud);
    if (upperClouds < 20) baseScore += 8;
    else if (upperClouds > 60) baseScore -= 10;

    if (altitudeDiffM >= 100 && altitudeDiffM <= 1500) {
      baseScore += 5;
    }
    if (precip > 1.5) baseScore -= 15;

    score = clamp(Math.round(baseScore), 25, 98);
    summary = `按启发式层位估算，观景点高出估算云顶 ${Math.max(0, altitudeDiffM)}m；低云较充足，${windSpeed < 3.5 ? "微风利于维持" : "风力偏大需防消散"}，仍需现场复核。`;
  } else if (position === "in") {
    score = clamp(Math.round(25 + (lowCloud > 60 ? 5 : 0) - windSpeed * 2), 10, 35);
    summary = `按启发式层位估算，观景点海拔（${site.altitude}m）落在估算云底（${baseM}m）与云顶（${topM}m）之间，存在云雾遮挡风险。`;
  } else if (position === "below") {
    score = clamp(Math.round(15 + lowCloud * 0.1), 5, 25);
    summary = `按启发式层位估算，观景点海拔（${site.altitude}m）低于估算云底（${baseM}m），当前条件不利于从高处俯瞰云海。`;
  } else {
    score = clamp(Math.round(10 + lowCloud * 0.2), 5, 20);
    summary = `低云量仅 ${Math.round(lowCloud)}%，当前低层云体不足，暂未形成明显云海条件。`;
  }

  return {
    score,
    position,
    baseM,
    topM,
    altitudeDiffM,
    summary,
  };
}

function finiteAt(
  values: Array<number | null> | undefined,
  index: number,
): number | null {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Evaluate a specific time window (e.g. morning 05:00-08:00 or evening
 * 17:00-19:00) for a mountain site. All averaged inputs use the same set of
 * valid hours so missing values from different timestamps can never be mixed
 * into one synthetic condition vector.
 */
export function evaluateCloudSeaWindow(
  site: CloudSeaSite,
  hourly: RawSiteHourly,
  windowHours: number[],
): CloudSeaWindowScore {
  if (!hourly.time || hourly.time.length === 0) {
    return CLOUD_SEA_EMPTY_WINDOW;
  }

  const activeIndices: number[] = [];
  hourly.time.forEach((time, index) => {
    const match = time.match(/T(\d{2}):/);
    const hour = match ? parseInt(match[1], 10) : new Date(time).getHours();
    if (windowHours.includes(hour)) {
      activeIndices.push(index);
    }
  });

  if (activeIndices.length === 0) {
    return {
      ...CLOUD_SEA_EMPTY_WINDOW,
      summary: "目标晨昏窗口没有对应的逐小时气象数据。",
    };
  }

  const validIndices = activeIndices.filter((index) =>
    finiteAt(hourly.cloud_cover_low, index) !== null &&
    finiteAt(hourly.cloud_cover_mid, index) !== null &&
    finiteAt(hourly.cloud_cover_high, index) !== null &&
    finiteAt(hourly.temperature_2m, index) !== null &&
    finiteAt(hourly.relative_humidity_2m, index) !== null &&
    finiteAt(hourly.wind_speed_10m, index) !== null &&
    finiteAt(hourly.precipitation, index) !== null,
  );

  if (validIndices.length === 0) {
    return {
      ...CLOUD_SEA_EMPTY_WINDOW,
      summary: "关键云量、湿度、风或降水数据不完整，无法计算云海条件指数。",
    };
  }

  const average = (values: Array<number | null> | undefined): number =>
    validIndices.reduce((sum, index) => sum + (finiteAt(values, index) ?? 0), 0) /
    validIndices.length;

  const conditions: CloudSeaConditions = {
    lowCloud: average(hourly.cloud_cover_low),
    midCloud: average(hourly.cloud_cover_mid),
    highCloud: average(hourly.cloud_cover_high),
    tempC: average(hourly.temperature_2m),
    humidity: average(hourly.relative_humidity_2m),
    windSpeed: average(hourly.wind_speed_10m),
    precip: average(hourly.precipitation),
  };
  const evaluation = evaluateConditions(site, conditions);

  let peakTime: string | null = null;
  let peakScore = Number.NEGATIVE_INFINITY;
  for (const index of validIndices) {
    const hourlyConditions: CloudSeaConditions = {
      lowCloud: finiteAt(hourly.cloud_cover_low, index)!,
      midCloud: finiteAt(hourly.cloud_cover_mid, index)!,
      highCloud: finiteAt(hourly.cloud_cover_high, index)!,
      tempC: finiteAt(hourly.temperature_2m, index)!,
      humidity: finiteAt(hourly.relative_humidity_2m, index)!,
      windSpeed: finiteAt(hourly.wind_speed_10m, index)!,
      precip: finiteAt(hourly.precipitation, index)!,
    };
    const hourlyEvaluation = evaluateConditions(site, hourlyConditions);
    if (hourlyEvaluation.score > peakScore) {
      peakScore = hourlyEvaluation.score;
      peakTime = hourly.time[index]?.slice(11, 16) ?? null;
    }
  }

  const hasMeaningfulLayer = evaluation.position !== "clear";
  const probabilityLevel = probabilityLevelFor(evaluation.score);
  return {
    score: evaluation.score,
    probabilityLevel,
    probabilityLabel: `${evaluation.score}/100`,
    cloudPosition: evaluation.position,
    positionLabel: positionLabel(evaluation.position),
    cloudBaseM: hasMeaningfulLayer ? evaluation.baseM : null,
    cloudTopM: hasMeaningfulLayer ? evaluation.topM : null,
    altitudeDiffM: hasMeaningfulLayer ? evaluation.altitudeDiffM : null,
    lowCloud: Math.round(conditions.lowCloud),
    midCloud: Math.round(conditions.midCloud),
    highCloud: Math.round(conditions.highCloud),
    humidity: Math.round(conditions.humidity),
    windSpeed: Math.round(conditions.windSpeed * 10) / 10,
    peakTime,
    summary: evaluation.summary,
  };
}

/** Build a snapshot for all cloud-sea sites on a given date. */
export function buildCloudSeaSnapshot(
  date: string,
  model: ForecastModel,
  weatherByDate: Record<string, Record<string, RawSiteHourly>>,
): CloudSeaSnapshot {
  const sitesRecord: Record<string, CloudSeaSiteScore> = {};
  const morningHours = [5, 6, 7, 8];
  const eveningHours = [17, 18, 19];

  for (const site of CLOUD_SEA_SITES) {
    const dateWeather = weatherByDate[date];
    const siteHourly = dateWeather ? (dateWeather[site.id] ?? dateWeather[site.name]) : null;

    if (!siteHourly) {
      sitesRecord[site.id] = {
        morning: CLOUD_SEA_EMPTY_WINDOW,
        evening: CLOUD_SEA_EMPTY_WINDOW,
      };
      continue;
    }

    sitesRecord[site.id] = {
      morning: evaluateCloudSeaWindow(site, siteHourly, morningHours),
      evening: evaluateCloudSeaWindow(site, siteHourly, eveningHours),
    };
  }

  return {
    date,
    model,
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo surface cloud + RH heuristic (Beta)",
    stale: false,
    sites: sitesRecord,
  };
}
