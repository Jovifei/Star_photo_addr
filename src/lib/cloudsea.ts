// Cloud-sea (云海预测) scoring for mountain observing sites.
//
// Evaluates cloud top/base heights, temperature inversion, relative humidity,
// ground wind speed and upper-level clearing against mountain summit elevations.
// Aligned with the product architecture and presentation standards of Fireglow.

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
  precipitation?: Array<number | null>;
  visibility?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
}

/**
 * Estimate condensation level (cloud base) and inversion/cloud top height
 * based on surface meteorology, mountain altitude, and low cloud cover.
 */
export function estimateCloudLayers(
  siteAltitude: number,
  lowCloudPct: number,
  tempC: number,
  windSpeedMs = 2.0,
): { baseM: number; topM: number } {
  // Approximate valley floor elevation ASL
  const valleyFloorM = Math.max(50, Math.round(siteAltitude * 0.35));
  
  // Condensation level (LCL) estimated above valley floor
  // Higher temp and wind push base higher; moist calm air keeps it lower
  const lclAboveValley = Math.round(
    Math.max(250, 400 + Math.max(0, tempC) * 20 + windSpeedMs * 15),
  );
  const baseM = valleyFloorM + lclAboveValley;

  // Cloud thickness expands with low cloud coverage
  // Typically 300m - 1200m thickness for stratocumulus / valley fog
  const thicknessM = Math.round(250 + (clamp(lowCloudPct) / 100) * 850);
  const topM = baseM + thicknessM;

  return { baseM, topM };
}

/**
 * Evaluate a specific time window (e.g. morning 05:00-09:00 or evening 17:00-19:30)
 * for a mountain site.
 */
export function evaluateCloudSeaWindow(
  site: CloudSeaSite,
  hourly: RawSiteHourly,
  windowHours: number[], // e.g. [5, 6, 7, 8]
): CloudSeaWindowScore {
  if (!hourly.time || hourly.time.length === 0) {
    return CLOUD_SEA_EMPTY_WINDOW;
  }

  // Find hourly entries matching the window (timezone-safe string match)
  const indices: number[] = [];
  hourly.time.forEach((t, i) => {
    const match = t.match(/T(\d{2}):/);
    const h = match ? parseInt(match[1], 10) : new Date(t).getHours();
    if (windowHours.includes(h)) {
      indices.push(i);
    }
  });

  const activeIndices = indices.length > 0 ? indices : hourly.time.map((_, i) => i);

  // Extract average parameters
  const avg = (arr?: Array<number | null>, def = 0) => {
    if (!arr) return def;
    let sum = 0;
    let count = 0;
    for (const idx of activeIndices) {
      const v = arr[idx];
      if (typeof v === "number" && Number.isFinite(v)) {
        sum += v;
        count += 1;
      }
    }
    return count > 0 ? sum / count : def;
  };

  const lowCloud = avg(hourly.cloud_cover_low, 20);
  const midCloud = avg(hourly.cloud_cover_mid, 10);
  const highCloud = avg(hourly.cloud_cover_high, 10);
  const tempC = avg(hourly.temperature_2m, 12);
  const windSpeed = avg(hourly.wind_speed_10m, 2.5);
  const precip = avg(hourly.precipitation, 0);

  // Derive estimated relative humidity proxy (higher low cloud & precip -> high humidity)
  const humidityProxy = Math.round(clamp(45 + lowCloud * 0.45 + (precip > 0 ? 20 : 0)));

  // Estimate cloud layers
  const { baseM, topM } = estimateCloudLayers(site.altitude, lowCloud, tempC, windSpeed);
  const altDiff = site.altitude - topM;

  // Determine observer position
  let pos: CloudPosition = "clear";
  if (lowCloud < 25) {
    pos = "clear";
  } else if (site.altitude >= topM + 30) {
    pos = "above"; // At least 30m above cloud top
  } else if (site.altitude >= baseM - 50) {
    pos = "in"; // Inside cloud deck / thick fog
  } else {
    pos = "below"; // Below cloud deck
  }

  // Calculate score
  let score = 0;
  let summary = "";

  if (pos === "above") {
    // Observer is ABOVE the clouds! Cloud sea potential is active.
    let baseScore = 65;

    // Rich low cloud cover provides dense valley sea
    if (lowCloud >= 75) baseScore += 18;
    else if (lowCloud >= 50) baseScore += 12;
    else baseScore += 5;

    // Calm winds keep the sea stable
    if (windSpeed < 2.0) baseScore += 10;
    else if (windSpeed < 3.5) baseScore += 5;
    else if (windSpeed > 6.0) baseScore -= 12;

    // Clear sky above (mid/high clouds don't block sunlight/blue sky)
    const upperClouds = Math.max(midCloud, highCloud);
    if (upperClouds < 20) baseScore += 8;
    else if (upperClouds > 60) baseScore -= 10;

    // Sufficient clearance above cloud top (100m ~ 1200m is ideal)
    if (altDiff >= 100 && altDiff <= 1500) {
      baseScore += 5;
    }

    // Heavy rain penalty
    if (precip > 1.5) baseScore -= 15;

    score = clamp(Math.round(baseScore), 25, 98);
    summary = `观景点高出云顶 ${Math.max(0, altDiff)}m，处于绝佳【云上海拔】。低云蓄积充足，${windSpeed < 3.5 ? "微风利于停驻" : "风力偏大需注意消散"}，上层通透度较好。`;
  } else if (pos === "in") {
    // Wrapped in thick fog
    score = clamp(Math.round(25 + (lowCloud > 60 ? 5 : 0) - windSpeed * 2), 10, 35);
    summary = `观景点海拔（${site.altitude}m）位于云顶（${topM}m）与云底（${baseM}m）之间，现场处于【云中大雾】，能见度受限，暂难俯瞰云海。`;
  } else if (pos === "below") {
    // Under overcast
    score = clamp(Math.round(15 + lowCloud * 0.1), 5, 25);
    summary = `观景点海拔（${site.altitude}m）低于云底（${baseM}m），处于【云下阴天】，仰头见阴云笼罩，不见漫顶云海。`;
  } else {
    // Clear sky, minimal clouds
    score = clamp(Math.round(10 + lowCloud * 0.2), 5, 20);
    summary = `低层水汽较少，低云量仅 ${Math.round(lowCloud)}%，气空高旷晴朗，暂未形成谷地云海条件。`;
  }

  const pLevel = probabilityLevelFor(score);
  const peakIdx = activeIndices[Math.floor(activeIndices.length / 2)] ?? activeIndices[0];
  const peakTimeStr = hourly.time[peakIdx] ? hourly.time[peakIdx].slice(11, 16) : null;

  return {
    score,
    probabilityLevel: pLevel,
    probabilityLabel: `${score}%`,
    cloudPosition: pos,
    positionLabel: positionLabel(pos),
    cloudBaseM: baseM,
    cloudTopM: topM,
    altitudeDiffM: altDiff,
    lowCloud: Math.round(lowCloud),
    midCloud: Math.round(midCloud),
    highCloud: Math.round(highCloud),
    humidity: humidityProxy,
    windSpeed: Math.round(windSpeed * 10) / 10,
    peakTime: peakTimeStr,
    summary,
  };
}

/**
 * Build snapshot for all cloud sea sites on a given date.
 */
export function buildCloudSeaSnapshot(
  date: string,
  model: ForecastModel,
  weatherByDate: Record<string, Record<string, RawSiteHourly>>,
): CloudSeaSnapshot {
  const sitesRecord: Record<string, CloudSeaSiteScore> = {};

  const morningHours = [5, 6, 7, 8];
  const eveningHours = [17, 18, 19];

  for (const site of CLOUD_SEA_SITES) {
    // Check if weather data exists for this site
    const dateWeather = weatherByDate[date];
    const siteHourly = dateWeather ? (dateWeather[site.id] ?? dateWeather[site.name]) : null;

    if (!siteHourly) {
      sitesRecord[site.id] = {
        morning: CLOUD_SEA_EMPTY_WINDOW,
        evening: CLOUD_SEA_EMPTY_WINDOW,
      };
      continue;
    }

    const morning = evaluateCloudSeaWindow(site, siteHourly, morningHours);
    const evening = evaluateCloudSeaWindow(site, siteHourly, eveningHours);

    sitesRecord[site.id] = { morning, evening };
  }

  return {
    date,
    model,
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo Pressure & Cloud Layer Engine",
    stale: false,
    sites: sitesRecord,
  };
}
