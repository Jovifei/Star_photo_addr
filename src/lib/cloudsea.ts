// Cloud-sea (云海条件指数) scoring for mountain observing sites.
//
// Surface cloud/RH/wind/precipitation describe whether moisture and low-cloud
// conditions are supportive. Summit/cloud vertical relation is only derived
// from Open-Meteo pressure-level model profiles; no synthetic LCL/cloud-base
// fallback is used when the pressure profile is unavailable.

import {
  deriveCloudLayers,
  detectTemperatureInversion,
  type TemperatureInversionEvidence,
} from "@/lib/cloudLayers";
import { CLOUD_SEA_SITES, type CloudSeaSite } from "@/lib/cloudseaSites";
import type {
  PressureForecastResponse,
  PressureLevelSample,
} from "@/lib/pressure";
import type { CloudLayer, ForecastModel, PressureLevel } from "@/lib/types";

export type CloudPosition = "above" | "in" | "below" | "clear" | "unknown";
export type PressureEvidenceStatus = "available" | "partial" | "unavailable";

export type CloudSeaConditionLevel =
  | "p20"
  | "p40"
  | "p60"
  | "p80"
  | "p90"
  | "p100";

/** @deprecated Use CloudSeaConditionLevel. */
export type CloudSeaProbabilityLevel = CloudSeaConditionLevel;

export interface CloudSeaWindowScore {
  score: number | null;
  conditionLevel: CloudSeaConditionLevel | null;
  conditionLabel: string | null;
  /** @deprecated Compatibility alias; this is not a calibrated probability. */
  probabilityLevel: CloudSeaConditionLevel | null;
  /** @deprecated Compatibility alias; this is not a calibrated probability. */
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
  pressureTime: string | null;
  pressureStatus: PressureEvidenceStatus;
  pressureConfidence: CloudLayer["confidence"] | null;
  inversion: TemperatureInversionEvidence;
  summary: string;
}

export interface CloudSeaSiteScore {
  morning: CloudSeaWindowScore;
  evening: CloudSeaWindowScore;
}

export interface CloudSeaPressureSummary {
  status: PressureEvidenceStatus;
  availableSites: number;
  totalSites: number;
  failedSites: number;
}

export interface CloudSeaSnapshot {
  date: string;
  model: ForecastModel;
  generatedAt: string;
  source: string;
  stale: boolean;
  refreshError?: string;
  pressure?: CloudSeaPressureSummary;
  sites: Record<string, CloudSeaSiteScore>;
}

const EMPTY_INVERSION: TemperatureInversionEvidence = {
  status: "unavailable",
  lowerMsl: null,
  upperMsl: null,
  deltaTempC: null,
  strength: null,
};

export const CLOUD_SEA_EMPTY_WINDOW: CloudSeaWindowScore = {
  score: null,
  conditionLevel: null,
  conditionLabel: null,
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
  pressureTime: null,
  pressureStatus: "unavailable",
  pressureConfidence: null,
  inversion: EMPTY_INVERSION,
  summary: "该时段无可用预报数据。",
};

export function positionLabel(pos: CloudPosition): string {
  switch (pos) {
    case "above":
      return "山顶在云层上方";
    case "in":
      return "山顶处于云层内";
    case "below":
      return "山顶在云层下方";
    case "clear":
      return "低云条件不足";
    default:
      return "数据不足";
  }
}

export function positionBadgeTone(
  pos: CloudPosition,
): "good" | "warn" | "bad" | "muted" {
  switch (pos) {
    case "above":
      return "good";
    case "in":
      return "bad";
    case "below":
      return "warn";
    default:
      return "muted";
  }
}

export function conditionLevelFor(score: number): CloudSeaConditionLevel {
  if (score < 20) return "p20";
  if (score < 40) return "p40";
  if (score < 60) return "p60";
  if (score < 80) return "p80";
  if (score < 90) return "p90";
  return "p100";
}

/** @deprecated Compatibility alias; this is a condition-index bucket. */
export function probabilityLevelFor(
  score: number | null,
): CloudSeaConditionLevel {
  return conditionLevelFor(score ?? 0);
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

interface CloudSeaConditions {
  lowCloud: number;
  midCloud: number;
  highCloud: number;
  tempC: number;
  humidity: number;
  windSpeed: number;
  precip: number;
}

interface VerticalEvidence {
  profileAvailable: boolean;
  layer: CloudLayer | null;
  inversion: TemperatureInversionEvidence;
}

interface HourEvaluation {
  score: number | null;
  position: CloudPosition;
  baseM: number | null;
  topM: number | null;
  altitudeDiffM: number | null;
  pressureAvailable: boolean;
  pressureConfidence: CloudLayer["confidence"] | null;
  inversion: TemperatureInversionEvidence;
  summary: string;
}

function pressureLevelFromSample(sample: PressureLevelSample): PressureLevel {
  return {
    pressure: sample.pressure,
    ...(sample.cloudCover == null ? {} : { cloudCover: sample.cloudCover }),
    ...(sample.humidity == null ? {} : { humidity: sample.humidity }),
    ...(sample.temperature == null ? {} : { temperature: sample.temperature }),
    ...(sample.heightMsl == null ? {} : { heightMsl: sample.heightMsl }),
  };
}

function pressureProfileAt(
  pressure: PressureForecastResponse | undefined,
  time: string,
): PressureLevelSample[] | null {
  if (!pressure) return null;
  const direct = pressure.profiles[time];
  if (direct) return direct;
  const key = Object.keys(pressure.profiles).find(
    (candidate) => candidate.slice(0, 16) === time.slice(0, 16),
  );
  return key ? pressure.profiles[key] ?? null : null;
}

/**
 * Select the lowest pressure-derived cloud deck that still belongs to the
 * lower troposphere. High-only 600/500 hPa decks are not treated as valley
 * cloud sea. This remains a model-grid diagnosis; surrounding-valley sampling
 * is a separate later phase.
 */
export function deriveCloudSeaVerticalEvidence(
  samples: PressureLevelSample[] | null,
  modelElevation: number,
  siteElevation: number,
): VerticalEvidence {
  if (!samples?.length) {
    return {
      profileAvailable: false,
      layer: null,
      inversion: EMPTY_INVERSION,
    };
  }
  const profile = samples.map(pressureLevelFromSample);
  const layers = deriveCloudLayers(profile, modelElevation, siteElevation);
  const lowerTroposphereLayers = layers
    .filter(
      (layer) =>
        layer.levels.some((level) => level.pressure >= 700) &&
        layer.baseAgl <= 3500,
    )
    .sort((left, right) => left.baseMsl - right.baseMsl);
  const layer = lowerTroposphereLayers[0] ?? null;
  const inversion = detectTemperatureInversion(
    profile,
    modelElevation,
    Math.max(siteElevation + 1500, modelElevation + 2000),
  );
  return { profileAvailable: true, layer, inversion };
}

function relationToPosition(relation: CloudLayer["relation"]): CloudPosition {
  if (relation === "云上") return "above";
  if (relation === "云中") return "in";
  return "below";
}

function inversionBonus(evidence: TemperatureInversionEvidence): number {
  if (evidence.status !== "detected") return 0;
  if (evidence.strength === "strong") return 8;
  if (evidence.strength === "moderate") return 6;
  return 3;
}

function inversionSummary(evidence: TemperatureInversionEvidence): string {
  if (evidence.status !== "detected") return "";
  return `；并检测到约 ${evidence.deltaTempC}°C 的低层逆温证据`;
}

function evaluateConditions(
  site: CloudSeaSite,
  conditions: CloudSeaConditions,
  pressure: PressureForecastResponse | undefined,
  time: string,
): HourEvaluation {
  const samples = pressureProfileAt(pressure, time);
  const vertical = deriveCloudSeaVerticalEvidence(
    samples,
    pressure?.modelElevation ?? 0,
    site.altitude,
  );

  if (conditions.lowCloud < 25) {
    const score = clamp(Math.round(8 + conditions.lowCloud * 0.35), 5, 20);
    return {
      score,
      position: "clear",
      baseM: null,
      topM: null,
      altitudeDiffM: null,
      pressureAvailable: vertical.profileAvailable,
      pressureConfidence: null,
      inversion: vertical.inversion,
      summary: `低云量仅 ${Math.round(conditions.lowCloud)}%，当前低层云体不足，暂未形成明显云海条件。`,
    };
  }

  if (!vertical.profileAvailable) {
    return {
      score: null,
      position: "unknown",
      baseM: null,
      topM: null,
      altitudeDiffM: null,
      pressureAvailable: false,
      pressureConfidence: null,
      inversion: EMPTY_INVERSION,
      summary: "surface 低云条件存在，但该时次压力层剖面不可用；不使用启发式云底补算山顶层位。",
    };
  }

  if (!vertical.layer) {
    return {
      score: null,
      position: "unknown",
      baseM: null,
      topM: null,
      altitudeDiffM: null,
      pressureAvailable: true,
      pressureConfidence: null,
      inversion: vertical.inversion,
      summary: "surface 低云条件存在，但压力层剖面未能定位连续低层云 deck；暂不推断云海层位。",
    };
  }

  const layer = vertical.layer;
  const position = relationToPosition(layer.relation);
  const altitudeDiffM = site.altitude - layer.topMsl;
  let score = 0;
  let summary = "";

  if (position === "above") {
    let baseScore = 55;
    if (conditions.lowCloud >= 75) baseScore += 18;
    else if (conditions.lowCloud >= 50) baseScore += 12;
    else baseScore += 5;

    if (conditions.humidity >= 85) baseScore += 8;
    else if (conditions.humidity >= 75) baseScore += 4;
    else if (conditions.humidity < 60) baseScore -= 8;

    if (conditions.windSpeed < 2.0) baseScore += 10;
    else if (conditions.windSpeed < 3.5) baseScore += 5;
    else if (conditions.windSpeed > 6.0) baseScore -= 12;

    const upperClouds = Math.max(conditions.midCloud, conditions.highCloud);
    if (upperClouds < 20) baseScore += 8;
    else if (upperClouds > 60) baseScore -= 10;

    if (altitudeDiffM >= 100 && altitudeDiffM <= 1500) baseScore += 5;
    baseScore += inversionBonus(vertical.inversion);
    if (conditions.precip > 1.5) baseScore -= 15;
    else if (conditions.precip >= 0.3) baseScore -= 5;

    score = clamp(Math.round(baseScore), 25, 98);
    summary = `数值模式压力剖面显示山顶高出低层云顶 ${Math.max(0, altitudeDiffM)}m；低云 ${Math.round(conditions.lowCloud)}%，${conditions.windSpeed < 3.5 ? "近地风较弱" : "风力偏大"}${inversionSummary(vertical.inversion)}。`;
  } else if (position === "in") {
    score = clamp(
      Math.round(20 + (conditions.lowCloud > 60 ? 6 : 0) - conditions.windSpeed * 2),
      8,
      35,
    );
    summary = `数值模式压力剖面显示山顶海拔（${site.altitude}m）落在低层云 deck（${layer.baseMsl}–${layer.topMsl}m）内，存在云雾包裹风险。`;
  } else {
    score = clamp(Math.round(12 + conditions.lowCloud * 0.1), 5, 25);
    summary = `数值模式压力剖面显示山顶海拔（${site.altitude}m）低于低层云 deck（${layer.baseMsl}–${layer.topMsl}m），不利于从峰顶俯瞰云海。`;
  }

  return {
    score,
    position,
    baseM: layer.baseMsl,
    topM: layer.topMsl,
    altitudeDiffM,
    pressureAvailable: true,
    pressureConfidence: layer.confidence,
    inversion: vertical.inversion,
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

function pressureStatusFor(
  available: number,
  total: number,
): PressureEvidenceStatus {
  if (available <= 0) return "unavailable";
  return available >= total ? "available" : "partial";
}

/**
 * Evaluate a morning/evening window. Surface metrics are averaged over hours
 * where all critical surface fields coexist. The 0–100 window score is the
 * mean of pressure-aware hourly scores; at least half of the surface-valid
 * hours must be scoreable, otherwise the cloud-sea conclusion is fail-closed.
 */
export function evaluateCloudSeaWindow(
  site: CloudSeaSite,
  hourly: RawSiteHourly,
  windowHours: number[],
  pressure?: PressureForecastResponse,
): CloudSeaWindowScore {
  if (!hourly.time?.length) return CLOUD_SEA_EMPTY_WINDOW;

  const activeIndices: number[] = [];
  hourly.time.forEach((time, index) => {
    const match = time.match(/T(\d{2}):/);
    const hour = match ? Number.parseInt(match[1], 10) : new Date(time).getHours();
    if (windowHours.includes(hour)) activeIndices.push(index);
  });

  if (activeIndices.length === 0) {
    return {
      ...CLOUD_SEA_EMPTY_WINDOW,
      summary: "目标晨昏窗口没有对应的逐小时气象数据。",
    };
  }

  const validIndices = activeIndices.filter(
    (index) =>
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
    validIndices.reduce(
      (sum, index) => sum + (finiteAt(values, index) ?? 0),
      0,
    ) / validIndices.length;

  const averageConditions: CloudSeaConditions = {
    lowCloud: average(hourly.cloud_cover_low),
    midCloud: average(hourly.cloud_cover_mid),
    highCloud: average(hourly.cloud_cover_high),
    tempC: average(hourly.temperature_2m),
    humidity: average(hourly.relative_humidity_2m),
    windSpeed: average(hourly.wind_speed_10m),
    precip: average(hourly.precipitation),
  };

  const hourlyEvaluations = validIndices.map((index) => {
    const conditions: CloudSeaConditions = {
      lowCloud: finiteAt(hourly.cloud_cover_low, index)!,
      midCloud: finiteAt(hourly.cloud_cover_mid, index)!,
      highCloud: finiteAt(hourly.cloud_cover_high, index)!,
      tempC: finiteAt(hourly.temperature_2m, index)!,
      humidity: finiteAt(hourly.relative_humidity_2m, index)!,
      windSpeed: finiteAt(hourly.wind_speed_10m, index)!,
      precip: finiteAt(hourly.precipitation, index)!,
    };
    const time = hourly.time[index]!;
    return {
      index,
      time,
      evaluation: evaluateConditions(site, conditions, pressure, time),
    };
  });

  const pressureHours = hourlyEvaluations.filter(
    ({ evaluation }) => evaluation.pressureAvailable,
  ).length;
  const pressureStatus = pressureStatusFor(pressureHours, validIndices.length);
  const scoreable = hourlyEvaluations.filter(
    ({ evaluation }) => evaluation.score !== null,
  );
  const minimumScoreable = Math.ceil(validIndices.length * 0.5);

  const baseMetrics = {
    lowCloud: Math.round(averageConditions.lowCloud),
    midCloud: Math.round(averageConditions.midCloud),
    highCloud: Math.round(averageConditions.highCloud),
    humidity: Math.round(averageConditions.humidity),
    windSpeed: Math.round(averageConditions.windSpeed * 10) / 10,
    pressureStatus,
  };

  if (scoreable.length < minimumScoreable) {
    return {
      ...CLOUD_SEA_EMPTY_WINDOW,
      ...baseMetrics,
      summary: `窗口内仅 ${scoreable.length}/${validIndices.length} 个有效时次具备可解释的云海层位证据；不使用启发式云底补齐。`,
    };
  }

  const score = Math.round(
    scoreable.reduce((sum, item) => sum + item.evaluation.score!, 0) /
      scoreable.length,
  );
  const peak = [...scoreable].sort(
    (left, right) => right.evaluation.score! - left.evaluation.score!,
  )[0]!;
  const conditionLevel = conditionLevelFor(score);
  const conditionLabel = `${score}/100`;
  const pressureTime = peak.evaluation.pressureAvailable ? peak.time : null;

  return {
    score,
    conditionLevel,
    conditionLabel,
    probabilityLevel: conditionLevel,
    probabilityLabel: conditionLabel,
    cloudPosition: peak.evaluation.position,
    positionLabel: positionLabel(peak.evaluation.position),
    cloudBaseM: peak.evaluation.baseM,
    cloudTopM: peak.evaluation.topM,
    altitudeDiffM: peak.evaluation.altitudeDiffM,
    ...baseMetrics,
    peakTime: peak.time.slice(11, 16),
    pressureTime,
    pressureConfidence: peak.evaluation.pressureConfidence,
    inversion: peak.evaluation.inversion,
    summary: `${peak.evaluation.summary} 窗口 ${scoreable.length}/${validIndices.length} 个时次参与条件指数。`,
  };
}

/** Build a snapshot for all cloud-sea sites on a given date. */
export function buildCloudSeaSnapshot(
  date: string,
  model: ForecastModel,
  weatherByDate: Record<string, Record<string, RawSiteHourly>>,
  pressureBySite: Record<string, PressureForecastResponse> = {},
  pressureErrors: Record<string, string> = {},
): CloudSeaSnapshot {
  const sitesRecord: Record<string, CloudSeaSiteScore> = {};
  const morningHours = [5, 6, 7, 8];
  const eveningHours = [17, 18, 19];

  for (const site of CLOUD_SEA_SITES) {
    const dateWeather = weatherByDate[date];
    const siteHourly = dateWeather
      ? (dateWeather[site.id] ?? dateWeather[site.name])
      : null;
    const pressure = pressureBySite[site.id];

    if (!siteHourly) {
      sitesRecord[site.id] = {
        morning: CLOUD_SEA_EMPTY_WINDOW,
        evening: CLOUD_SEA_EMPTY_WINDOW,
      };
      continue;
    }

    sitesRecord[site.id] = {
      morning: evaluateCloudSeaWindow(site, siteHourly, morningHours, pressure),
      evening: evaluateCloudSeaWindow(site, siteHourly, eveningHours, pressure),
    };
  }

  const availableSites = CLOUD_SEA_SITES.filter(
    (site) => pressureBySite[site.id],
  ).length;
  const totalSites = CLOUD_SEA_SITES.length;
  const failedSites = Math.max(
    totalSites - availableSites,
    Object.keys(pressureErrors).length,
  );

  return {
    date,
    model,
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo surface weather + pressure-level model profile (Beta)",
    stale: false,
    pressure: {
      status: pressureStatusFor(availableSites, totalSites),
      availableSites,
      totalSites,
      failedSites: Math.min(totalSites, failedSites),
    },
    sites: sitesRecord,
  };
}
