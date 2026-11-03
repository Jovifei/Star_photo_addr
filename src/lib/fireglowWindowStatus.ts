import type { FireGlowSnapshot, FireGlowWindowScore } from "./fireglow";

/** A rule exclusion is a valid weather result, not a zero score or a data outage. */
export type FireGlowWindowStatus = "scored" | "rain-excluded" | "no-solar-window" | "insufficient";

const LEGACY_RAIN_REASON = "窗口内降水明显，云层无法被落日点燃。";
const LEGACY_SOLAR_REASON = "晨昏窗口内没有满足太阳高度筛选的可用时次。";

/** Read old snapshots without refetching/deleting them. Only documented exact
 * legacy reasons are recognized; arbitrary null scores remain insufficient. */
export function fireGlowWindowStatus(window: FireGlowWindowScore | null | undefined): FireGlowWindowStatus {
  if (!window) return "insufficient";
  if (typeof window.score === "number") {
    return Number.isFinite(window.score) && window.score >= 0 && window.score <= 100 &&
      (window.status === undefined || window.status === "scored") ? "scored" : "insufficient";
  }
  if (window.score !== null || window.band !== "none") return "insufficient";
  if (window.status === "rain-excluded" || window.status === "no-solar-window") return window.status;
  if (window.status !== undefined) return "insufficient";
  if (window.reason === LEGACY_RAIN_REASON) return "rain-excluded";
  if (window.reason === LEGACY_SOLAR_REASON) return "no-solar-window";
  return "insufficient";
}

export function hasFireGlowWindowData(window: FireGlowWindowScore | null | undefined): boolean {
  return fireGlowWindowStatus(window) !== "insufficient";
}

/** Cache/transport availability counts data-backed outcomes, not recommendations.
 * Freshness, provider identity and model gates are still checked separately. */
export function countFireGlowDataSites(snapshot: Pick<FireGlowSnapshot, "sites"> | null | undefined): number {
  return Object.values(snapshot?.sites ?? {}).filter((site) =>
    hasFireGlowWindowData(site?.morning) || hasFireGlowWindowData(site?.evening),
  ).length;
}

export function fireGlowWindowLabel(window: FireGlowWindowScore | null | undefined): string {
  switch (fireGlowWindowStatus(window)) {
    case "rain-excluded": return "降水条件排除";
    case "no-solar-window": return "无晨昏窗口";
    case "scored": return window?.bandLabel ?? "条件指数";
    default: return "数据不足";
  }
}

export function fireGlowWindowReason(window: FireGlowWindowScore | null | undefined): string {
  if (fireGlowWindowStatus(window) === "rain-excluded" && window?.reason === LEGACY_RAIN_REASON) {
    return "窗口内降水明显，按现有降水规则排除，不计算条件指数；这不表示天气数据缺失。";
  }
  return window?.reason || "所选晨昏窗口缺少可用数据。";
}
