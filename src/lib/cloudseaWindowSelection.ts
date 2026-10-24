import type { CloudSeaWindowScore } from "./cloudsea";

/** Rank published window means first; retain the best known hour if none can publish. */
export function selectCloudSeaWindow<T extends { window: CloudSeaWindowScore }>(entries: T[]): T | null {
  const rank = (win: CloudSeaWindowScore) => [
    win.score ?? -1,
    win.peakScore ?? -1,
    win.coverage?.scoreableHours ?? 0,
    win.coverage?.surfaceValidHours ?? 0,
    Number([win.lowCloud, win.midCloud, win.highCloud, win.humidity, win.windSpeed].some(value => value != null)),
  ];
  return entries.reduce<T | null>((best, entry) => {
    if (!best) return entry;
    const left = rank(entry.window), right = rank(best.window);
    const difference = left.findIndex((value, index) => value !== right[index]);
    return difference >= 0 && left[difference] > right[difference] ? entry : best;
  }, null);
}
