import { dataAgeMs } from "./forecastIntegrity";
import { snapshotSourceTime, type SnapshotProvenance } from "./snapshotProvenance";
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
import {
  hasUsablePressureProfile,
  isThermodynamicPressureLevelSample,
} from "@/lib/pressureIntegrity";
import { pressureProfileAt } from "@/lib/pressureIntegrity";
import type { PressureForecastResponse, PressureLevelSample } from "@/lib/pressure";
import type { CloudLayer, ForecastModel, PressureLevel } from "@/lib/types";

export type CloudPosition = "above" | "in" | "below" | "clear" | "unknown";
export const CLOUD_SEA_SCORE_VERSION = "cloudsea-native-conservative-v3";
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
  /** Mean over scoreable hours; published only with a majority of target hours. */
  score: number | null;
  /** Best known hour, even when coverage is too sparse to publish a window mean. */
  peakScore?: number | null;
  coverage?: {
    expectedHours: number;
    surfaceValidHours: number;
    scoreableHours: number;
    /** Surface-valid hours with a usable pressure profile at the same time. */
    pressureHours: number;
  };
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
  /** Highest cloudy sample is a lower bound; next clear sample bounds the top. */
  cloudTopUpperM?: number | null;
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

export interface CloudSeaSurfaceSummary {
  status: PressureEvidenceStatus;
  availableSites: number;
  totalSites: number;
  failedSites: number;
}

export function hasValidCloudSeaCoverageCounts(
  summary: CloudSeaSurfaceSummary | CloudSeaPressureSummary | null | undefined,
  expectedSiteCount: number,
): boolean {
  return Boolean(
    summary &&
    Number.isInteger(expectedSiteCount) &&
    expectedSiteCount >= 0 &&
    Number.isInteger(summary.availableSites) &&
    Number.isInteger(summary.totalSites) &&
    Number.isInteger(summary.failedSites) &&
    summary.totalSites === expectedSiteCount &&
    summary.availableSites >= 0 &&
    summary.availableSites <= summary.totalSites &&
    summary.failedSites === summary.totalSites - summary.availableSites,
  );
}

export function hasCompleteCloudSeaCoverage(
  summary: CloudSeaSurfaceSummary | CloudSeaPressureSummary | null | undefined,
  expectedSiteCount: number,
): boolean {
  return Boolean(
    hasValidCloudSeaCoverageCounts(summary, expectedSiteCount) &&
    summary?.status === "available" &&
    summary.availableSites === expectedSiteCount &&
    summary.failedSites === 0,
  );
}

export interface CloudSeaSnapshot {
  scoreVersion?: string;
  providerValidationVersion?: string;
  date: string;
  model: ForecastModel;
  generatedAt: string;
  provenance?: SnapshotProvenance;
  transport?: { servedAt: string };
  source: string;
  stale: boolean;
  refreshError?: string;
  surface?: CloudSeaSurfaceSummary;
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
  peakScore: null,
  coverage: { expectedHours: 0, surfaceValidHours: 0, scoreableHours: 0, pressureHours: 0 },
  conditionLevel: null,
  conditionLabel: null,
  probabilityLevel: null,
  probabilityLabel: null,
  cloudPosition: "unknown",
  positionLabel: "数据不足",
  cloudBaseM: null,
  cloudTopM: null,
  cloudTopUpperM: null,
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

/** Old responses remain inspectable facts, but cannot republish qualified scores. */
export function qualifyCloudSeaSnapshot(snapshot: CloudSeaSnapshot): CloudSeaSnapshot {
  if (snapshot.scoreVersion === CLOUD_SEA_SCORE_VERSION) return snapshot;
  const withhold = (window: CloudSeaWindowScore): CloudSeaWindowScore => ({
    ...window, score: null, peakScore: null, peakTime: null,
    summary: "旧版层位未验证，保留地面天气事实，暂不发布评分。",
    ...(window.coverage ? { coverage: { ...window.coverage, scoreableHours: 0 } } : {}),
    conditionLevel: null, conditionLabel: null, probabilityLevel: null, probabilityLabel: null,
    cloudPosition: "unknown", positionLabel: "层位未验证", cloudBaseM: null, cloudTopM: null, cloudTopUpperM: null, altitudeDiffM: null,
  });
  return { ...snapshot, stale: true, refreshError: "评分版本已更新，旧分数暂不发布，请刷新天气来源。",
    sites: Object.fromEntries(Object.entries(snapshot.sites).map(([id, windows]) => [id, { morning: withhold(windows.morning), evening: withhold(windows.evening) }])) };
}

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
  sourceFetchedAt?: string | null;
  sourceGrid?: { providerModel: string; latitude: number; longitude: number; elevation: number };
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
  humidity: number;
  windSpeed: number;
  precip: number;
}

interface VerticalEvidence {
  profileAvailable: boolean;
  resolution: "resolved" | "ambiguous" | "unavailable";
  cloudTopUpperM?: number | null;
  layer: CloudLayer | null;
  inversion: TemperatureInversionEvidence;
}

interface HourEvaluation {
  score: number | null;
  position: CloudPosition;
  baseM: number | null;
  topM: number | null;
  topUpperM?: number | null;
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

/**
 * Prefer a deck enveloping the summit; otherwise select the lowest cloud deck
 * in the lower troposphere. An hour is only pressure-available when at
 * least six levels contain cloud/RH/temperature/geopotential-height together.
 * High-only 600/500 hPa decks are not treated as valley cloud sea.
 */
export function deriveCloudSeaVerticalEvidence(
  samples: PressureLevelSample[] | null,
  modelElevation: number,
  siteElevation: number,
  nativeLevels?: readonly number[],
): VerticalEvidence {
  if (nativeLevels) samples = samples?.filter(sample => nativeLevels.includes(sample.pressure)) ?? null;
  if (!hasUsablePressureProfile(samples)) {
    return {
      profileAvailable: false,
      resolution: "unavailable",
      layer: null,
      inversion: EMPTY_INVERSION,
    };
  }

  const completeSamples = samples!.filter(sample => isThermodynamicPressureLevelSample(sample) && sample.heightMsl! >= modelElevation);
  const profile = completeSamples.map(pressureLevelFromSample);
  const layers = deriveCloudLayers(profile, modelElevation, siteElevation);
  // A sampled cloudy level is only the lower bound of its cloud top. The next
  // clear level supplies the upper bound; never interpolate an unobserved top.
  const valid = completeSamples.filter(sample => sample.heightMsl! >= modelElevation - 50)
    .sort((a, b) => a.heightMsl! - b.heightMsl!);
  const cloudy = (sample: PressureLevelSample) => (sample.cloudCover ?? 0) >= 55 || sample.humidity! >= 90;
  const clear = (sample: PressureLevelSample) => !cloudy(sample) && sample.humidity != null && sample.humidity <= 75;
  const enclosing = layers.find(layer => layer.relation === "云中");
  const transitionEnclosesSummit = layers.some(layer => {
    const first = layer.levels[0].heightMsl!;
    const last = layer.levels.at(-1)!.heightMsl!;
    const below = valid.filter(sample => sample.heightMsl! < first && clear(sample)).at(-1);
    const above = valid.find(sample => sample.heightMsl! > last && clear(sample));
    return (siteElevation > last + 150 && (!above || siteElevation <= Math.ceil(above.heightMsl!) + 150)) ||
      (siteElevation < first - 150 && (!below || siteElevation >= below.heightMsl! - 150));
  });
  const lowerTroposphereLayers = layers
    .filter(
      (layer) =>
        layer.levels.some((level) => level.pressure >= 700) &&
        layer.baseAgl <= 3500,
    )
    .sort((left, right) => left.baseMsl - right.baseMsl);
  const lowerAtSite = valid.filter(sample => sample.heightMsl! <= siteElevation).at(-1);
  const upperAtSite = valid.find(sample => sample.heightMsl! >= siteElevation);
  // Qualification policy, not an interpolated cloud boundary. Coarse archival
  // profiles can have all six required fields yet leave >1km around the summit.
  const localGapUnresolved = !lowerAtSite || !upperAtSite || upperAtSite.heightMsl! - lowerAtSite.heightMsl! > 750 || !clear(lowerAtSite) || !clear(upperAtSite);
  // A higher deck can envelop the summit even when a valley deck lies below it.
  const candidate = enclosing ?? (transitionEnclosesSummit || localGapUnresolved ? null : lowerTroposphereLayers[0] ?? null);
  const humidityOnly = candidate?.relation === "云上" && !candidate.levels.some(level => (level.cloudCover ?? 0) >= 55);
  const layer = humidityOnly ? null : candidate;
  const clearAbove = layer ? valid.find(sample => sample.heightMsl! > layer.levels.at(-1)!.heightMsl! && clear(sample)) : null;
  const cloudTopUpperM = clearAbove ? Math.ceil(clearAbove.heightMsl!) : null;
  const upperBoundNotCleared = layer?.relation === "云上" && (cloudTopUpperM == null || siteElevation <= cloudTopUpperM + 150);
  const inversion = detectTemperatureInversion(
    profile,
    modelElevation,
    Math.max(siteElevation + 1500, modelElevation + 2000),
  );
  return { profileAvailable: true, resolution: (transitionEnclosesSummit || localGapUnresolved || humidityOnly || upperBoundNotCleared) && !enclosing ? "ambiguous" : "resolved", cloudTopUpperM, layer: upperBoundNotCleared ? null : layer, inversion };
}

function relationToPosition(relation: CloudLayer["relation"]): CloudPosition {
  if (relation === "云上") return "above";
  if (relation === "云中") return "in";
  return "below";
}

function inversionSummary(evidence: TemperatureInversionEvidence): string {
  if (evidence.status !== "detected") return "";
  return `；同一低层模式剖面另检测到约 ${evidence.deltaTempC}°C 的逆温证据`;
}

function evaluateConditions(
  site: CloudSeaSite,
  conditions: CloudSeaConditions,
  pressure: PressureForecastResponse | undefined,
  time: string,
): HourEvaluation {
  const samples = pressure?.stale ? null : pressureProfileAt(pressure, time);
  const vertical = deriveCloudSeaVerticalEvidence(
    samples,
    pressure?.nativeGridElevationM ?? pressure?.modelElevation ?? 0,
    site.altitude,
    pressure?.qualifiedPressureLevels,
  );

  if (conditions.lowCloud < 25 && !vertical.layer && vertical.resolution !== "ambiguous") {
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

  if (pressure?.verticalReference !== "native-grid-v2" || !Number.isFinite(pressure.nativeGridElevationM)) {
    return { score: null, position: "unknown", baseM: null, topM: null, altitudeDiffM: null,
      pressureAvailable: vertical.profileAvailable, pressureConfidence: null, inversion: vertical.inversion,
      summary: "压力来源未证明使用模式原生地形，不能将降尺度海拔当作地下层边界。" };
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
      summary:
        "surface 低云条件存在，但该时次不足 6 个完整压力层；不使用启发式云底补算山顶层位。",
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
      summary:
        vertical.resolution === "ambiguous" ? "山顶位于未解析的云顶或云底高度区间，暂不判断云上条件。" : "压力层剖面未能定位连续低层云 deck；暂不推断云海层位。",
    };
  }

  const layer = vertical.layer;
  const position = relationToPosition(layer.relation);
  const altitudeDiffM = Math.floor(site.altitude - (position === "above" ? vertical.cloudTopUpperM! : layer.topMsl));
  let score = 0;
  let summary = "";

  if (position === "above") {
    let baseScore = 55;
    const deckCloud = Math.max(conditions.lowCloud, ...layer.levels.map(level => level.cloudCover ?? 0));
    if (deckCloud >= 75) baseScore += 18;
    else if (deckCloud >= 50) baseScore += 12;
    else baseScore += 5;
    // Grid-terrain RH is not summit RH; it cannot establish summit clearance.

    if (conditions.windSpeed < 2.0) baseScore += 10;
    else if (conditions.windSpeed < 3.5) baseScore += 5;
    else if (conditions.windSpeed > 6.0) baseScore -= 12;

    const upperClouds = Math.max(conditions.midCloud, conditions.highCloud);
    if (upperClouds < 20) baseScore += 8;
    else if (upperClouds > 60) baseScore -= 10;

    if (altitudeDiffM >= 100 && altitudeDiffM <= 1500) baseScore += 5;
    if (conditions.precip > 1.5) baseScore -= 15;
    else if (conditions.precip >= 0.3) baseScore -= 5;

    // Inversion remains model evidence shown to the user. It is intentionally
    // not a score bonus until its relation to the selected cloud deck is
    // calibrated against observations; otherwise an unrelated inversion aloft
    // can incorrectly inflate the cloud-sea index.
    score = clamp(Math.round(baseScore), 25, 98);
    summary = `数值模式压力剖面显示山顶至少高出低层云顶上界 ${Math.max(
      0,
      altitudeDiffM,
    )}m；低云 ${Math.round(conditions.lowCloud)}%，${
      conditions.windSpeed < 3.5 ? "近地风较弱" : "风力偏大"
    }${inversionSummary(vertical.inversion)}。`;
  } else if (position === "in") {
    score = clamp(
      Math.round(
        20 +
          (conditions.lowCloud > 60 ? 6 : 0) -
          conditions.windSpeed * 2,
      ),
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
    baseM: Math.floor(layer.levels[0].heightMsl! / 50) * 50,
    topM: Math.floor(layer.levels.at(-1)!.heightMsl! / 50) * 50,
    topUpperM: vertical.cloudTopUpperM,
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
 * where all critical score inputs coexist. The 0–100 window score is the mean
 * of interpretable hourly scores. A strict majority of the requested hours
 * must be scoreable; missing surface hours stay in the coverage denominator.
 */
export function evaluateCloudSeaWindow(
  site: CloudSeaSite,
  hourly: RawSiteHourly,
  windowHours: number[],
  pressure?: PressureForecastResponse,
  targetDate?: string,
): CloudSeaWindowScore {
  const targetHours = new Set(windowHours);
  const coverage = {
    expectedHours: targetHours.size,
    surfaceValidHours: 0,
    scoreableHours: 0,
    pressureHours: 0,
  };
  const emptyWindow = { ...CLOUD_SEA_EMPTY_WINDOW, coverage };
  if (!hourly.time?.length) return emptyWindow;

  const activeIndices: number[] = [];
  const seenHours = new Set<number>();
  hourly.time.forEach((time, index) => {
    // Single Runs can contain multiple calendar dates. Never satisfy a
    // selected day's hour with the same wall-clock hour from an earlier day.
    if (targetDate && !time.startsWith(`${targetDate}T`)) return;
    const match = time.match(/T(\d{2}):/);
    const hour = match
      ? Number.parseInt(match[1], 10)
      : new Date(time).getHours();
    if (targetHours.has(hour) && !seenHours.has(hour)) {
      activeIndices.push(index);
      seenHours.add(hour);
    }
  });

  if (activeIndices.length === 0) {
    return {
      ...emptyWindow,
      summary: "目标晨昏窗口没有对应的逐小时气象数据。",
    };
  }

  const validIndices = activeIndices.filter(
    (index) =>
      finiteAt(hourly.cloud_cover_low, index) !== null &&
      finiteAt(hourly.cloud_cover_mid, index) !== null &&
      finiteAt(hourly.cloud_cover_high, index) !== null &&
      finiteAt(hourly.relative_humidity_2m, index) !== null &&
      finiteAt(hourly.wind_speed_10m, index) !== null &&
      finiteAt(hourly.precipitation, index) !== null,
  );
  coverage.surfaceValidHours = validIndices.length;

  if (validIndices.length === 0) {
    return {
      ...emptyWindow,
      summary:
        "关键云量、湿度、风或降水数据不完整，无法计算云海条件指数。",
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
    humidity: average(hourly.relative_humidity_2m),
    windSpeed: average(hourly.wind_speed_10m),
    precip: average(hourly.precipitation),
  };

  const hourlyEvaluations = validIndices.map((index) => {
    const conditions: CloudSeaConditions = {
      lowCloud: finiteAt(hourly.cloud_cover_low, index)!,
      midCloud: finiteAt(hourly.cloud_cover_mid, index)!,
      highCloud: finiteAt(hourly.cloud_cover_high, index)!,
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
  const pressureStatus = pressureStatusFor(
    pressureHours,
    coverage.expectedHours,
  );
  const scoreable = hourlyEvaluations.filter(
    ({ evaluation }) => evaluation.score !== null,
  );
  coverage.pressureHours = pressureHours;
  coverage.scoreableHours = scoreable.length;
  const minimumScoreable = Math.floor(coverage.expectedHours / 2) + 1;
  const peak = [...scoreable].sort(
    (left, right) => right.evaluation.score! - left.evaluation.score!,
  )[0];
  const peakMetrics = peak ? {
    peakScore: peak.evaluation.score,
    peakTime: peak.time.slice(11, 16),
    pressureTime: peak.evaluation.pressureAvailable ? peak.time : null,
    cloudPosition: peak.evaluation.position,
    positionLabel: positionLabel(peak.evaluation.position),
    cloudBaseM: peak.evaluation.baseM,
    cloudTopM: peak.evaluation.topM,
    cloudTopUpperM: peak.evaluation.topUpperM ?? null,
    altitudeDiffM: peak.evaluation.altitudeDiffM,
    pressureConfidence: peak.evaluation.pressureConfidence,
    inversion: peak.evaluation.inversion,
  } : {};

  const baseMetrics = {
    lowCloud: Math.round(averageConditions.lowCloud),
    midCloud: Math.round(averageConditions.midCloud),
    highCloud: Math.round(averageConditions.highCloud),
    humidity: Math.round(averageConditions.humidity),
    windSpeed: Math.round(averageConditions.windSpeed * 10) / 10,
    pressureStatus,
    coverage,
  };

  if (scoreable.length < minimumScoreable || !peak) {
    return {
      ...emptyWindow,
      ...baseMetrics,
      ...peakMetrics,
      summary: `窗口内仅 ${scoreable.length}/${coverage.expectedHours} 个目标时次具备可解释的云海条件；必须超过半数才发布窗口指数，且不使用启发式云底补齐。${peak ? ` 最佳已知小时 ${peak.time.slice(11, 16)} 的单小时证据：${peak.evaluation.summary}` : [...new Set(hourlyEvaluations.map(item => item.evaluation.summary))].slice(0, 2).join(" ")}`,
    };
  }

  const score = Math.round(
    scoreable.reduce((sum, item) => sum + item.evaluation.score!, 0) /
      scoreable.length,
  );
  const conditionLevel = conditionLevelFor(score);
  const conditionLabel = `${score}/100`;

  return {
    ...emptyWindow,
    score,
    conditionLevel,
    conditionLabel,
    probabilityLevel: conditionLevel,
    probabilityLabel: conditionLabel,
    ...baseMetrics,
    ...peakMetrics,
    summary: `${peak.evaluation.summary} 窗口 ${scoreable.length}/${coverage.expectedHours} 个目标时次参与平均条件指数。`,
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
    const candidate = pressureBySite[site.id];
    const pressure = candidate && !candidate.stale && candidate.model === model ? candidate : undefined;

    sitesRecord[site.id] = {
      morning: evaluateCloudSeaWindow(
        site,
        siteHourly ?? { time: [] },
        morningHours,
        pressure,
        date,
      ),
      evening: evaluateCloudSeaWindow(
        site,
        siteHourly ?? { time: [] },
        eveningHours,
        pressure,
        date,
      ),
    };
  }

  const hasSurfaceWindow = (window: CloudSeaWindowScore) =>
    window.coverage !== undefined &&
    window.coverage.expectedHours > 0 &&
    window.coverage.surfaceValidHours === window.coverage.expectedHours &&
    window.lowCloud !== null &&
    window.midCloud !== null &&
    window.highCloud !== null &&
    window.humidity !== null &&
    window.windSpeed !== null;
  const totalSites = CLOUD_SEA_SITES.length;
  const surfaceAvailableSites = CLOUD_SEA_SITES.filter((site) => {
    const windows = sitesRecord[site.id];
    return Boolean(
      windows &&
      hasSurfaceWindow(windows.morning) &&
      hasSurfaceWindow(windows.evening),
    );
  }).length;
  const surfaceFailedSites = totalSites - surfaceAvailableSites;

  const availableSites = CLOUD_SEA_SITES.filter(
    (site) => pressureBySite[site.id] && !pressureBySite[site.id].stale && pressureBySite[site.id].model === model,
  ).length;
  const failedSites = Math.max(
    totalSites - availableSites,
    Object.keys(pressureErrors).length,
  );

  return {
    scoreVersion: CLOUD_SEA_SCORE_VERSION,
    date,
    model,
    generatedAt: new Date().toISOString(),
    provenance: {
      version: 1,
      sourcesBySite: Object.fromEntries(CLOUD_SEA_SITES.map((site) => {
        const surface = weatherByDate[date]?.[site.id] ?? weatherByDate[date]?.[site.name];
        const pressureSource = pressureBySite[site.id];
        // Omitted data sets belong to coverage, not to an invented source
        // timestamp. A PRESENT source with an invalid timestamp still
        // contributes an invalid provenance entry and fails freshness closed.
        return [site.id, [
          ...(surface ? [snapshotSourceTime("surface", model, surface.sourceFetchedAt)] : []),
          ...(pressureSource ? [snapshotSourceTime("pressure", pressureSource.model, pressureSource.fetchedAt)] : []),
        ]];
      })),
    },
    source:
      availableSites > 0
        ? "Open-Meteo surface weather + pressure-level model profile (Beta)"
        : "Open-Meteo surface weather; pressure-level model profile unavailable (Beta)",
    stale: Object.values(weatherByDate[date] ?? {}).some(record => !Number.isFinite(dataAgeMs(record.sourceFetchedAt))) || Object.values(pressureBySite).some(record => record.stale || record.model !== model || !Number.isFinite(dataAgeMs(record.fetchedAt))),
    surface: {
      status: pressureStatusFor(surfaceAvailableSites, totalSites),
      availableSites: surfaceAvailableSites,
      totalSites,
      failedSites: surfaceFailedSites,
    },
    pressure: {
      status: pressureStatusFor(availableSites, totalSites),
      availableSites,
      totalSites,
      failedSites: Math.min(totalSites, failedSites),
    },
    sites: sitesRecord,
  };
}
