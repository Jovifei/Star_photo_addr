import { dataAgeMs } from "./forecastIntegrity";
import type { SnapshotProvenance } from "./snapshotProvenance";
import type { FireGlowSnapshot } from "./fireglow";
import type { FinderWeatherStatus } from "./stargazingFinderTypes";
import type { ForecastModel } from "./types";

/** Matches the fireglow API freshness threshold; retention has separate limits. */
export const FIRE_GLOW_FRESH_MS = 30 * 60_000;

export interface FireGlowSourceQuality {
  version: 1;
  bySite: Record<string, { status: FinderWeatherStatus; model: ForecastModel | null }>;
  /** `site` certifies that stale is caused solely by site status/source age. */
  staleScope: "none" | "site" | "snapshot";
}

export type FireGlowQuality = {
  state: "fresh" | "stale" | "expired" | "unknown" | "insufficient" | "refresh-failed";
  notice: string;
};

function hasValidSourceGroups(provenance: SnapshotProvenance | undefined): boolean {
  const groups = provenance?.sourcesBySite;
  return Boolean(groups && typeof groups === "object" && !Array.isArray(groups) &&
    Object.values(groups).every((group) => Array.isArray(group) && group.every((source) => source && typeof source === "object")));
}

/** Date.parse normalizes impossible dates such as February 30; never trust them as acquisition times. */
export function fireGlowSourceTimeAgeMs(timestamp: unknown, now = Date.now()): number {
  if (typeof timestamp !== "string") return Infinity;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T/i.exec(timestamp);
  if (!parts) return Infinity;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return Infinity;
  // Preserve dataAgeMs's absolute-zone and five-minute future-clock rules.
  return dataAgeMs(timestamp, now);
}

/** Invalid persisted JSON is unknown, never fresh. The shared clock rules remain unchanged. */
export function fireGlowSourceAgeMs(provenance: SnapshotProvenance | undefined, now = Date.now()): number {
  if (!hasValidSourceGroups(provenance)) return Infinity;
  const sources = Object.values(provenance!.sourcesBySite).flat();
  return sources.length ? Math.max(...sources.map((source) => fireGlowSourceTimeAgeMs(source.sourceFetchedAt, now))) : Infinity;
}

/** Only the causes used by buildFireGlowSnapshot and snapshotJson explain site-scoped stale. */
function hasSiteStaleCause(snapshot: FireGlowSnapshot, now: number): boolean {
  if (!hasValidSourceGroups(snapshot.provenance)) return false;
  const statuses = Object.values(snapshot.sourceQuality?.bySite ?? {});
  if (statuses.some((item) => item?.status === "stale" || item?.status === "error")) return true;
  const sources = Object.values(snapshot.provenance?.sourcesBySite ?? {}).flat();
  return sources.some((source) => fireGlowSourceTimeAgeMs(source?.sourceFetchedAt, now) > FIRE_GLOW_FRESH_MS);
}

export function fireGlowBatchDegraded(snapshot: FireGlowSnapshot, now: number): boolean {
  return Boolean(snapshot.stale || snapshot.refreshError) ||
    fireGlowSourceAgeMs(snapshot.provenance, now) > FIRE_GLOW_FRESH_MS;
}

/** Assess the exact displayed date, site and phase. Never substitute transport or generation time. */
export function fireGlowSiteQuality(
  snapshot: FireGlowSnapshot | null | undefined,
  date: string,
  siteId: string,
  phase: "morning" | "evening",
  model: ForecastModel,
  dateError: string | undefined,
  now: number,
): FireGlowQuality {
  if (dateError || snapshot?.refreshError) return { state: "refresh-failed", notice: "数据已降级：所选日期刷新失败，保留的结果不作新鲜推荐。" };
  if (!snapshot || snapshot.date !== date || snapshot.model !== model) return { state: "unknown", notice: "数据已降级：所选日期或模型无法核验。" };
  const score = snapshot.sites?.[siteId]?.[phase]?.score;
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    return { state: "insufficient", notice: "数据不足：所选晨晚窗口没有有效评分。" };
  }
  const quality = snapshot.sourceQuality;
  const site = quality?.version === 1 ? quality.bySite?.[siteId] : undefined;
  if (!site || site.model !== model) return { state: "unknown", notice: "数据已降级：所选地点来源状态或模型无法核验。" };
  if (site.status === "stale") return { state: "stale", notice: "数据已降级：所选地点使用降级的天气来源，不作新鲜推荐。" };
  if (site.status === "missing" || site.status === "error") return { state: "insufficient", notice: "数据不足：所选地点天气来源缺失或请求失败。" };
  if (site.status !== "available") return { state: "unknown", notice: "数据已降级：所选地点来源状态无法核验。" };
  const sources = snapshot.provenance?.version === 1 ? snapshot.provenance.sourcesBySite?.[siteId] : undefined;
  if (!Array.isArray(sources) || sources.length !== 1 || sources[0]?.provider !== "Open-Meteo" || sources[0]?.dataset !== "surface" || sources[0]?.model !== model) {
    return { state: "unknown", notice: "数据已降级：所选地点的来源或模型无法核验。" };
  }
  if (!hasValidSourceGroups(snapshot.provenance)) return { state: "unknown", notice: "数据已降级：快照来源结构异常，无法核验。" };
  const age = fireGlowSourceTimeAgeMs(sources[0].sourceFetchedAt, now);
  if (!Number.isFinite(age)) return { state: "unknown", notice: "数据已降级：所选地点原始采集时间缺失或异常。" };
  if (age > FIRE_GLOW_FRESH_MS) return { state: "expired", notice: "数据已降级：所选地点原始天气已超过 30 分钟，不作新鲜推荐。" };
  if (snapshot.stale && (quality?.staleScope !== "site" || !hasSiteStaleCause(snapshot, now))) {
    return { state: "unknown", notice: "数据已降级：快照整体状态无法归因到其他地点。" };
  }
  return { state: "fresh", notice: "" };
}
