// Fire-glow (火烧云 / 朝晚霞) scoring for the curated site library.
//
// Model v1 (documented limits, no AOD yet): fire glow needs mid/high cloud
// to catch low-sun light while the lower deck stays thin, around civil
// twilight. We score each site's evening and morning twilight windows from
// the same Open-Meteo hourly grids the observing snapshot uses
// (cloud_cover_low/mid/high, precipitation, visibility, gusts) plus
// astronomy-engine sun altitude. CAMS aerosol depth is a planned refinement;
// visibility stands in as the haze proxy for now.

import * as Astronomy from "astronomy-engine";
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { ForecastModel } from "@/lib/types";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

export type FireGlowBand = "strong" | "medium" | "light" | "faint" | "none" | "unknown";

export interface FireGlowWindowScore {
  score: number | null;
  band: FireGlowBand;
  bandLabel: string;
  peakTime: string | null;
  deckCloud: number | null;
  lowCloud: number | null;
  visibilityKm: number | null;
  sunAltitude: number | null;
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
  sites: Record<string, FireGlowSiteScore>;
}

const EMPTY_WINDOW: FireGlowWindowScore = {
  score: null,
  band: "unknown",
  bandLabel: "数据不足",
  peakTime: null,
  deckCloud: null,
  lowCloud: null,
  visibilityKm: null,
  sunAltitude: null,
  reason: "该日无可用预报数据。",
};

const NONE_WINDOW: FireGlowWindowScore = {
  score: null,
  band: "none",
  bandLabel: "窗口缺失",
  peakTime: null,
  deckCloud: null,
  lowCloud: null,
  visibilityKm: null,
  sunAltitude: null,
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

function scoreHour(hour: GlowHour): number {
  // Mid/high deck is the canvas; the sweet spot is a broad but broken deck.
  const deck = clamp(hour.cloudMid + hour.cloudHigh, 0, 100);
  const deckScore = clamp(100 - Math.abs(deck - 65) * 1.1, 0, 100);
  // A thick low deck hides the lit clouds above it.
  const lowPenalty = clamp(1 - Math.max(0, hour.cloudLow - 35) / 55, 0.15, 1);
  // Fire glow peaks when the sun sits just below the horizon (-1.5° ideal).
  const sunScore = clamp(100 - Math.abs(hour.sunAltitude + 1.5) * 16, 0, 100);
  const hazeFactor = hour.visibility == null
    ? 1
    : hour.visibility < 5000
      ? 0.75
      : hour.visibility <= 35000
        ? 1
        : 0.92;
  const gustPenalty = hour.gust != null && hour.gust > 13 ? 0.85 : 1;
  return (deckScore * 0.62 + sunScore * 0.38) * lowPenalty * hazeFactor * gustPenalty;
}

function bandFor(score: number): FireGlowBand {
  if (score >= 72) return "strong";
  if (score >= 52) return "medium";
  if (score >= 34) return "light";
  return "faint";
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
  return {
    score,
    band,
    bandLabel: BAND_LABELS[band],
    peakTime: best.time.slice(11, 16),
    deckCloud: deck,
    lowCloud: low,
    visibilityKm: best.visibility == null ? null : Math.round(best.visibility / 100) / 10,
    sunAltitude: Math.round(best.sunAltitude * 10) / 10,
    reason: `中高云 ${deck}%、低云 ${low}%，最佳时刻 ${best.time.slice(11, 16)} 太阳高度 ${Math.round(best.sunAltitude * 10) / 10}°。`,
  };
}

export function scoreFireGlowSite(
  site: { id: string; latitude: number; longitude: number },
  record: FinderWeatherRecord | undefined,
): FireGlowSiteScore {
  if (!record?.hourly?.time?.length) {
    return { evening: { ...EMPTY_WINDOW }, morning: { ...EMPTY_WINDOW } };
  }
  return {
    evening: scoreWindow(collectGlowHours(record, site, "evening")),
    morning: scoreWindow(collectGlowHours(record, site, "morning")),
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
    sites[site.id] = scoreFireGlowSite(site, dayRecords[site.id]);
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
