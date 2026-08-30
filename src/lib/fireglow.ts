// Fire-glow (火烧云 / 朝晚霞) scoring for the curated site library.
//
// Model v2. Cloud-canvas weights (high×0.75 / mid×0.45 / low×0.10) and the
// phase-aware optimal moments (-6~-4° high-cloud eruption, -2~+2° mid-cloud,
// +2~+5° low cloud) are adopted from the open-source
// LibraHo/weather-sunset-predictor, which documents them against the
// sunsetbot.top tutorial. Probability bands follow the 莉景天气 presentation
// convention (20% steps, green→yellow→orange→red). CAMS aerosol depth is a
// planned refinement; visibility stands in as the haze proxy for now.

import * as Astronomy from "astronomy-engine";
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { ForecastModel } from "@/lib/types";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

export type FireGlowBand = "strong" | "medium" | "light" | "faint" | "none" | "unknown";

/**
 * 概率分级（莉景天气式呈现），供地图色阶与列表徽章共用。
 * 顶部 80%+ 细分三级（80–88 / 88–95 / 95–100），概率越高颜色越深——
 * 用户最关心的是接近满概率的爆发区。
 */
export type FireGlowProbabilityLevel =
  | "p20"
  | "p40"
  | "p60"
  | "p80"
  | "p88"
  | "p95"
  | "p100";

export interface FireGlowWindowScore {
  score: number | null;
  band: FireGlowBand;
  bandLabel: string;
  /** 概率区间文案，如 “60–80%”。 */
  probabilityLabel: string | null;
  probabilityLevel: FireGlowProbabilityLevel | null;
  /** 鲜艳度 0–1（sunsetbot 口径），如 0.42。 */
  vividness: number | null;
  /** 分相最佳时刻：高云爆发 / 中云爆发 / 低云时刻 / 过渡。 */
  momentLabel: string | null;
  peakTime: string | null;
  deckCloud: number | null;
  lowCloud: number | null;
  midCloud: number | null;
  highCloud: number | null;
  visibilityKm: number | null;
  sunAltitude: number | null;
  /** 金色时刻（太阳 -4°）/ 蓝色时刻（-6°）/ 天文晨昏（-18°），HH:mm。 */
  goldenTime: string | null;
  blueTime: string | null;
  astroTime: string | null;
  reason: string;
}

export interface FireGlowSiteScore {
  evening: FireGlowWindowScore;
  morning: FireGlowWindowScore;
}

export interface FireGlowSnapshot {
  date: string;
  model: ForecastModel;
  generatedAt: string;
  source: string;
  stale: boolean;
  /** Set when a forced refresh failed and an older snapshot was served. */
  refreshError?: string;
  sites: Record<string, FireGlowSiteScore>;
}

const EMPTY_WINDOW: FireGlowWindowScore = {
  score: null,
  band: "unknown",
  bandLabel: "数据不足",
  probabilityLabel: null,
  probabilityLevel: null,
  vividness: null,
  momentLabel: null,
  peakTime: null,
  deckCloud: null,
  lowCloud: null,
  midCloud: null,
  highCloud: null,
  visibilityKm: null,
  sunAltitude: null,
  goldenTime: null,
  blueTime: null,
  astroTime: null,
  reason: "该日无可用预报数据。",
};

const NONE_WINDOW: FireGlowWindowScore = {
  score: null,
  band: "none",
  bandLabel: "窗口缺失",
  probabilityLabel: "0–20%",
  probabilityLevel: "p20",
  vividness: null,
  momentLabel: null,
  peakTime: null,
  deckCloud: null,
  lowCloud: null,
  midCloud: null,
  highCloud: null,
  visibilityKm: null,
  sunAltitude: null,
  goldenTime: null,
  blueTime: null,
  astroTime: null,
  reason: "晨昏窗口内没有可点燃的云：全晴或完全遮蔽。",
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function sunAltitudeDegrees(date: Date, latitude: number, longitude: number): number {
  const observer = new Astronomy.Observer(latitude, longitude, 0);
  const equator = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
  return Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal").altitude;
}

interface SunAltitudePoint {
  hour: number;
  altitude: number;
}

/** 全日太阳高度序列（北京时间小时），供晨昏穿越插值复用。 */
function daySunAltitudeSeries(
  times: string[],
  site: { latitude: number; longitude: number },
  dateKey: string,
): SunAltitudePoint[] {
  const observer = new Astronomy.Observer(site.latitude, site.longitude, 0);
  const series: SunAltitudePoint[] = [];
  for (const time of times) {
    if (!time || time.slice(0, 10) !== dateKey) continue;
    const hour = Number(time.slice(11, 13)) + Number(time.slice(14, 16)) / 60;
    if (!Number.isFinite(hour)) continue;
    const date = parseShanghaiTime(time);
    const equator = Astronomy.Equator(Astronomy.Body.Sun, date, observer, true, true);
    const altitude = Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal").altitude;
    series.push({ hour, altitude });
  }
  return series.sort((left, right) => left.hour - right.hour);
}

function hourFloatToLabel(hourFloat: number): string {
  const minutes = Math.round(hourFloat * 60);
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * 金色/蓝色/天文晨昏时刻（太阳穿越 -4°/-6°/-18°，HH:mm）。
 * 从小时级高度序列线性插值——比逐次 SearchAltitude 快几个量级，
 * 精度约 ±5 分钟，作为展示型参考时刻足够。
 */
function twilightCrossing(
  series: SunAltitudePoint[],
  target: number,
  direction: "rising" | "setting",
): string | null {
  for (let index = 0; index < series.length - 1; index += 1) {
    const left = series[index];
    const right = series[index + 1];
    if (direction === "setting") {
      if (left.altitude >= target && right.altitude < target) {
        const fraction = (left.altitude - target) / Math.max(1e-6, left.altitude - right.altitude);
        return hourFloatToLabel(left.hour + fraction * (right.hour - left.hour));
      }
    } else if (left.altitude <= target && right.altitude > target) {
      const fraction = (target - left.altitude) / Math.max(1e-6, right.altitude - left.altitude);
      return hourFloatToLabel(left.hour + fraction * (right.hour - left.hour));
    }
  }
  return null;
}

/** Finder times are wall-clock Asia/Shanghai; anchor them explicitly. */
function parseShanghaiTime(time: string): Date {
  return new Date(`${time}:00+08:00`);
}

interface GlowHour {
  time: string;
  hour: number;
  cloudLow: number;
  cloudMid: number;
  cloudHigh: number;
  precip: number;
  gust: number | null;
  visibility: number | null;
  sunAltitude: number;
}

function collectGlowHours(
  record: FinderWeatherRecord | undefined,
  site: { latitude: number; longitude: number },
  phase: "evening" | "morning",
): GlowHour[] {
  const hourly = record?.hourly;
  if (!hourly?.time?.length) return [];
  const hourRange = phase === "evening" ? [15, 20] : [4, 9];
  const hours: GlowHour[] = [];
  for (let index = 0; index < hourly.time.length; index += 1) {
    const time = hourly.time[index];
    if (!time) continue;
    const localHour = Number(time.slice(11, 13));
    if (localHour < hourRange[0] || localHour > hourRange[1]) continue;
    const date = parseShanghaiTime(time);
    const sunAltitude = sunAltitudeDegrees(date, site.latitude, site.longitude);
    if (sunAltitude < -6 || sunAltitude > 4) continue;
    hours.push({
      time,
      hour: localHour,
      cloudLow: hourly.cloud_cover_low?.[index] ?? 0,
      cloudMid: hourly.cloud_cover_mid?.[index] ?? 0,
      cloudHigh: hourly.cloud_cover_high?.[index] ?? 0,
      precip: hourly.precipitation?.[index] ?? 0,
      gust: hourly.wind_gusts_10m?.[index] ?? null,
      visibility: hourly.visibility?.[index] ?? null,
      sunAltitude,
    });
  }
  return hours;
}

// 云种权重：高云（卷云/高积云）是火烧云最佳载体，低云主要遮挡光路。
// 口径来自 LibraHo/weather-sunset-predictor（对齐 sunsetbot.top 教程）。
const CLOUD_WEIGHTS = { high: 0.75, mid: 0.45, low: 0.1 };
const WEIGHT_SUM = CLOUD_WEIGHTS.high + CLOUD_WEIGHTS.mid + CLOUD_WEIGHTS.low;

/** 加权“画布”云量 0–100：高云主导比单纯中高云加和更贴近燃烧条件。 */
function weightedCanvas(hour: GlowHour): number {
  return clamp(
    (hour.cloudHigh * CLOUD_WEIGHTS.high + hour.cloudMid * CLOUD_WEIGHTS.mid + hour.cloudLow * CLOUD_WEIGHTS.low) /
      WEIGHT_SUM *
      1.3,
    0,
    100,
  );
}

/** 分相最佳时刻（开源口径）：-6~-4° 烧高云，-2~+2° 烧中云，+2~+5° 烧低云。 */
function momentLabelFor(sunAltitude: number): string {
  if (sunAltitude >= -6 && sunAltitude < -4) return "高云爆发";
  if (sunAltitude >= -2 && sunAltitude <= 2) return "中云爆发";
  if (sunAltitude > 2 && sunAltitude <= 5) return "低云时刻";
  return "过渡时段";
}

function scoreHour(hour: GlowHour): number {
  const canvas = weightedCanvas(hour);
  // 画布峰值约 55%：太少无云可烧，太厚遮光。
  const canvasScore = clamp(100 - Math.abs(canvas - 55) * 1.3, 0, 100);
  // 厚低云层遮挡被照亮的云。
  const lowPenalty = clamp(1 - Math.max(0, hour.cloudLow - 35) / 55, 0.15, 1);
  // 最佳太阳区间 [-5, 0]，区间外按距离衰减。
  const distance = Math.max(0, hour.sunAltitude > 0 ? hour.sunAltitude : -5 - hour.sunAltitude);
  const sunScore = clamp(100 - distance * 14, 0, 100);
  const hazeFactor = hour.visibility == null
    ? 1
    : hour.visibility < 5000
      ? 0.75
      : hour.visibility <= 35000
        ? 1
        : 0.92;
  const gustPenalty = hour.gust != null && hour.gust > 13 ? 0.85 : 1;
  // 全晴无云可烧（借鉴 clear_but_no_cloud_canvas 扣分）。
  const noCanvasCap = canvas < 15 ? 0.55 : 1;
  return (canvasScore * 0.62 + sunScore * 0.38) * lowPenalty * hazeFactor * gustPenalty * noCanvasCap;
}

function bandFor(score: number): FireGlowBand {
  if (score >= 72) return "strong";
  if (score >= 52) return "medium";
  if (score >= 34) return "light";
  return "faint";
}

/** 莉景式概率区间：顶部细分，80% 以上按 88 / 95 再分档。 */
export function probabilityRangeFor(score: number | null): { label: string; level: FireGlowProbabilityLevel } | null {
  if (score == null) return null;
  if (score >= 88) return { label: "95–100%", level: "p100" };
  if (score >= 80) return { label: "88–95%", level: "p95" };
  if (score >= 72) return { label: "80–88%", level: "p88" };
  if (score >= 52) return { label: "60–80%", level: "p80" };
  if (score >= 34) return { label: "40–60%", level: "p60" };
  if (score >= 15) return { label: "20–40%", level: "p40" };
  return { label: "0–20%", level: "p20" };
}

const BAND_LABELS: Record<FireGlowBand, string> = {
  strong: "大烧",
  medium: "中烧",
  light: "小烧",
  faint: "难烧",
  none: "窗口缺失",
  unknown: "数据不足",
};

export function fireGlowBandLabel(band: FireGlowBand): string {
  return BAND_LABELS[band];
}

function scoreWindow(
  hours: GlowHour[],
  sunSeries: SunAltitudePoint[],
  phase: "evening" | "morning",
): FireGlowWindowScore {
  const candidates = hours.filter((hour) => hour.precip == null || hour.precip <= 0.3);
  if (!hours.length) {
    return { ...NONE_WINDOW, reason: "晨昏窗口内无可用时次（全晴或数据缺失）。" };
  }
  if (!candidates.length) {
    return { ...NONE_WINDOW, reason: "窗口内降水明显，云层无法被落日点燃。" };
  }
  let best = candidates[0];
  let bestScore = -1;
  for (const hour of candidates) {
    const value = scoreHour(hour);
    if (value > bestScore) {
      bestScore = value;
      best = hour;
    }
  }
  const score = Math.round(clamp(bestScore, 0, 100));
  const deck = Math.round(clamp(best.cloudMid + best.cloudHigh, 0, 100));
  const low = Math.round(clamp(best.cloudLow, 0, 100));
  const band = bandFor(score);
  const probability = probabilityRangeFor(score);
  const canvas = weightedCanvas(best);
  const momentLabel = momentLabelFor(best.sunAltitude);
  const direction = phase === "evening" ? "setting" : "rising";
  return {
    score,
    band,
    bandLabel: BAND_LABELS[band],
    probabilityLabel: probability?.label ?? null,
    probabilityLevel: probability?.level ?? null,
    vividness: Math.min(0.99, Math.round((score / 100) * (canvas / 70) * 100) / 100),
    momentLabel,
    peakTime: best.time.slice(11, 16),
    deckCloud: deck,
    lowCloud: low,
    midCloud: Math.round(clamp(best.cloudMid, 0, 100)),
    highCloud: Math.round(clamp(best.cloudHigh, 0, 100)),
    visibilityKm: best.visibility == null ? null : Math.round(best.visibility / 100) / 10,
    sunAltitude: Math.round(best.sunAltitude * 10) / 10,
    goldenTime: twilightCrossing(sunSeries, -4, direction),
    blueTime: twilightCrossing(sunSeries, -6, direction),
    astroTime: twilightCrossing(sunSeries, -18, direction),
    reason: `${momentLabel}：高云 ${Math.round(best.cloudHigh)}%、中云 ${Math.round(best.cloudMid)}%、低云 ${low}%，最佳时刻 ${best.time.slice(11, 16)}。`,
  };
}

export function scoreFireGlowSite(
  site: { id: string; latitude: number; longitude: number },
  record: FinderWeatherRecord | undefined,
  dateKey?: string,
): FireGlowSiteScore {
  if (!record?.hourly?.time?.length || !dateKey) {
    return { evening: { ...EMPTY_WINDOW }, morning: { ...EMPTY_WINDOW } };
  }
  const sunSeries = daySunAltitudeSeries(record.hourly.time, site, dateKey);
  return {
    evening: scoreWindow(collectGlowHours(record, site, "evening"), sunSeries, "evening"),
    morning: scoreWindow(collectGlowHours(record, site, "morning"), sunSeries, "morning"),
  };
}

export function buildFireGlowSnapshot(
  date: string,
  model: ForecastModel,
  weatherByDate: Record<string, Record<string, FinderWeatherRecord>>,
): FireGlowSnapshot {
  const sites: Record<string, FireGlowSiteScore> = {};
  const dayRecords = weatherByDate[date] ?? {};
  for (const site of OBSERVING_SITES) {
    sites[site.id] = scoreFireGlowSite(site, dayRecords[site.id], date);
  }
  const records = Object.values(dayRecords);
  return {
    date,
    model,
    generatedAt: new Date().toISOString(),
    source: "Open-Meteo Forecast API（云层/降水/能见度）+ astronomy-engine 太阳高度角",
    stale: records.some((record) => record.status === "stale" || record.status === "error"),
    sites,
  };
}
