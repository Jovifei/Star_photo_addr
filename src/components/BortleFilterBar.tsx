"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { toggleBortleLevel } from "@/lib/bortleFilters";
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { BortleLevel } from "@/lib/types";

/**
 * Catalog-reference dark-sky colours for dark surfaces. These B1–B4 values are
 * curated site-library metadata, not a live raster/SQM measurement. Brighter
 * dot = darker reference class; text labels carry the meaning.
 */
export const SITE_BORTLE_COLORS: Record<BortleLevel, string> = {
  1: "#e8f4ff",
  2: "#a9cce8",
  3: "#6b93b8",
  4: "#56636f",
};

export const BORTLE_DESCRIPTIONS: Record<BortleLevel, string> = {
  1: "极暗",
  2: "自然暗夜",
  3: "乡村夜空",
  4: "乡村/郊区过渡",
};

/** Command-bar presets keep the catalog choice and recommendation threshold aligned. */
export const BORTLE_SCORE_THRESHOLDS: Record<BortleLevel, number> = {
  1: 85,
  2: 70,
  3: 55,
  4: 50,
};

export function siteBortleColor(level: number): string {
  return SITE_BORTLE_COLORS[level as BortleLevel] ?? "#56636f";
}

/** Catalog-reference B1–B4 combined filter. */
export default function BortleFilterBar({
  variant = "map",
}: {
  variant?: "map" | "command";
} = {}) {
  const {
    state,
    setObservingBortleLevels,
    setRecommendationThreshold,
  } = useStore();
  const counts = useMemo(() => {
    const result: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    for (const site of OBSERVING_SITES) {
      result[site.bortle] = (result[site.bortle] ?? 0) + 1;
    }
    return result;
  }, []);
  return (
    <div
      className={`bortle-filter-bar${variant === "command" ? " bortle-filter-bar-command" : ""}`}
      data-testid="bortle-filter-bar"
      role="group"
      aria-label="按目录参考暗空级别筛选点位"
    >
      {([1, 2, 3, 4] as BortleLevel[]).map((level) => {
        const pressed = state.observingBortleLevels.includes(level);
        return (
          <button
            key={level}
            type="button"
            aria-pressed={pressed}
            data-score-threshold={BORTLE_SCORE_THRESHOLDS[level]}
            aria-label={`筛选目录参考 B${level} 点位，${BORTLE_DESCRIPTIONS[level]}，推荐门槛 ≥${BORTLE_SCORE_THRESHOLDS[level]} 分，${counts[level]} 个`}
            title={`目录参考 B${level}：${BORTLE_DESCRIPTIONS[level]}；推荐门槛预设 ≥${BORTLE_SCORE_THRESHOLDS[level]} 分；仅用于点位库筛选，不是当前栅格或现场 SQM 实测`}
            onClick={() => {
              if (variant === "command") {
                setObservingBortleLevels([level]);
                setRecommendationThreshold(BORTLE_SCORE_THRESHOLDS[level]);
                return;
              }
              setObservingBortleLevels(toggleBortleLevel(state.observingBortleLevels, level));
            }}
          >
            <i style={{ background: siteBortleColor(level) }} aria-hidden="true" />
            <span>
              <b>B{level}</b>
              <em>{BORTLE_DESCRIPTIONS[level]}</em>
              <small>≥{BORTLE_SCORE_THRESHOLDS[level]}分</small>
            </span>
          </button>
        );
      })}
    </div>
  );
}
