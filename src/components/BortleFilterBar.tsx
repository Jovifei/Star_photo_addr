"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { toggleBortleLevel } from "@/lib/bortleFilters";
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { BortleLevel } from "@/lib/types";

/**
 * Point-library Bortle colours for dark surfaces. The official VIIRS ramp
 * renders B1/B2 near-black, which disappears on the night background, so the
 * site library uses this monochrome light-to-dark ramp instead: brighter dot
 * = darker sky. Text labels carry the meaning; colour is never the only cue.
 */
export const SITE_BORTLE_COLORS: Record<BortleLevel, string> = {
  1: "#e8f4ff",
  2: "#a9cce8",
  3: "#6b93b8",
  4: "#56636f",
};

export function siteBortleColor(level: number): string {
  return SITE_BORTLE_COLORS[level as BortleLevel] ?? "#56636f";
}

/** Sites-workspace B1–B4 combined filter, docked above the map. */
export default function BortleFilterBar() {
  const { state, setObservingBortleLevels } = useStore();
  const counts = useMemo(() => {
    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const site of OBSERVING_SITES) {
      result[site.bortle] = (result[site.bortle] ?? 0) + 1;
    }
    return result;
  }, []);
  return (
    <div
      className="bortle-filter-bar"
      data-testid="bortle-filter-bar"
      role="group"
      aria-label="按 Bortle 本底筛选点位"
    >
      {([1, 2, 3, 4] as BortleLevel[]).map((level) => {
        const pressed = state.observingBortleLevels.includes(level);
        return (
          <button
            key={level}
            type="button"
            aria-pressed={pressed}
            aria-label={`筛选 B${level} 点位，${counts[level]} 个`}
            onClick={() =>
              setObservingBortleLevels(toggleBortleLevel(state.observingBortleLevels, level))
            }
          >
            <i style={{ background: siteBortleColor(level) }} aria-hidden="true" />
            <span>
              B{level}
              <small>{counts[level]}</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
