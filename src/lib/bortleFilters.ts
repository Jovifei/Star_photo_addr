import type { BortleLevel } from "@/lib/types";

export const ALL_BORTLE_LEVELS: readonly BortleLevel[] = [1, 2, 3, 4];
export const DEFAULT_BORTLE_LEVELS: BortleLevel[] = [1, 2, 3];

function isBortleLevel(value: unknown): value is BortleLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function normalizeBortleLevels(value: unknown): BortleLevel[] {
  if (!Array.isArray(value)) return [...DEFAULT_BORTLE_LEVELS];
  const levels = ALL_BORTLE_LEVELS.filter((level) => value.includes(level));
  return levels.length ? [...levels] : [...DEFAULT_BORTLE_LEVELS];
}

export function bortleLevelsForLimit(limit: 3 | 4): BortleLevel[] {
  return ALL_BORTLE_LEVELS.filter((level) => level <= limit).slice() as BortleLevel[];
}

export function toggleBortleLevel(
  selected: readonly BortleLevel[],
  level: BortleLevel,
): BortleLevel[] {
  const current = normalizeBortleLevels(selected);
  if (current.includes(level)) {
    if (current.length === 1) return current;
    return current.filter((item) => item !== level);
  }
  return ALL_BORTLE_LEVELS.filter((item) => current.includes(item) || item === level).slice() as BortleLevel[];
}

export function filterSitesByBortleLevels<T extends { bortle: number }>(
  sites: readonly T[],
  selected: readonly BortleLevel[],
): T[] {
  const levels = new Set(normalizeBortleLevels(selected));
  return sites.filter((site) => isBortleLevel(site.bortle) && levels.has(site.bortle));
}

export function describeBortleLevels(selected: readonly BortleLevel[]): string {
  const levels = normalizeBortleLevels(selected);
  const contiguous = levels.every((level, index) => level === levels[0]! + index);
  return contiguous ? `B1–B${levels.at(-1)}` : levels.map((level) => `B${level}`).join("、");
}
