import { snapshotScoreAtTime } from "@/lib/observingSites";
import type {
  BortleLevel,
  ObservationSnapshot,
  ObservingSite,
  RecommendationBand,
  RecommendationScore,
} from "@/lib/types";

export const MIN_VIEWPORT_RECOMMENDATION_ZOOM = 6;
export const MAX_VIEWPORT_RECOMMENDATIONS = 12;

export interface MapViewport {
  north: number;
  south: number;
  east: number;
  west: number;
  zoom: number;
}

export interface ViewportRecommendationFilters {
  /** Legacy contiguous filter kept for old callers. */
  bortleLimit?: 3 | 4;
  /** Individually selected Bortle classes from the map control. */
  bortleLevels?: BortleLevel[];
  recommendationThreshold: number;
  recommendedOnly: boolean;
  visibleBands: RecommendationBand[];
  limit?: number;
}

export interface ViewportRecommendation {
  rank: number;
  site: ObservingSite;
  score: RecommendationScore | null;
  stars: number;
  reason: string;
}

const BAND_ORDER: Record<RecommendationBand, number> = {
  priority: 0,
  recommended: 1,
  watch: 2,
  "not-recommended": 3,
  unknown: 4,
};

function longitudeInside(longitude: number, viewport: MapViewport): boolean {
  // Leaflet bounds cross the antimeridian when west > east.
  return viewport.west <= viewport.east
    ? longitude >= viewport.west && longitude <= viewport.east
    : longitude >= viewport.west || longitude <= viewport.east;
}

export function siteInsideViewport(
  site: Pick<ObservingSite, "latitude" | "longitude">,
  viewport: MapViewport,
): boolean {
  return (
    site.latitude >= viewport.south &&
    site.latitude <= viewport.north &&
    longitudeInside(site.longitude, viewport)
  );
}

export function scoreToStars(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  if (score >= 85) return 5;
  if (score >= 70) return 4;
  if (score >= 55) return 3;
  if (score >= 40) return 2;
  return 1;
}

export function recommendationReason(
  site: ObservingSite,
  score: RecommendationScore | null,
): string {
  if (score?.blockers?.length) return score.blockers.slice(0, 2).join("、");
  if (score?.score == null) {
    return site.description?.trim() || "当前时次天气数据不足，建议稍后复核";
  }
  if (score.cloud != null && score.cloud <= 20 && site.bortle <= 2) {
    return "暗夜基础突出，当前时次云量较低";
  }
  if (score.bestWindow) return `连续观测窗口 ${score.bestWindow}`;
  if (score.cloud != null && score.cloud <= 35) {
    return "当前云量较低，适合优先查看详情";
  }
  return site.description?.trim() || "进入当前视野候选，建议结合现场条件复核";
}

export function dominantProvince(
  recommendations: ViewportRecommendation[],
): string | null {
  if (!recommendations.length) return null;
  const counts = new Map<string, number>();
  for (const item of recommendations) {
    counts.set(item.site.province, (counts.get(item.site.province) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"),
  )[0]?.[0] ?? null;
}

export function rankViewportRecommendations(
  sites: ObservingSite[],
  snapshot: ObservationSnapshot | null | undefined,
  viewport: MapViewport,
  filters: ViewportRecommendationFilters,
): ViewportRecommendation[] {
  const visibleBands = new Set(filters.visibleBands);
  const limit = Math.min(
    MAX_VIEWPORT_RECOMMENDATIONS,
    Math.max(1, Math.floor(filters.limit ?? MAX_VIEWPORT_RECOMMENDATIONS)),
  );

  const ranked = sites
    .filter((site) => siteInsideViewport(site, viewport))
    .filter((site) =>
      filters.bortleLevels
        ? filters.bortleLevels.includes(site.bortle)
        : site.bortle <= (filters.bortleLimit ?? 4),
    )
    .map((site) => ({ site, score: snapshotScoreAtTime(snapshot, site.id) }))
    .filter(({ score }) => {
      if (
        filters.recommendedOnly &&
        (score?.score == null || score.score < filters.recommendationThreshold)
      ) {
        return false;
      }
      return !score?.band || score.band === "unknown" || visibleBands.has(score.band);
    })
    .sort((left, right) => {
      const leftScore = left.score?.score ?? Number.NEGATIVE_INFINITY;
      const rightScore = right.score?.score ?? Number.NEGATIVE_INFINITY;
      return (
        rightScore - leftScore ||
        BAND_ORDER[left.score?.band ?? "unknown"] -
          BAND_ORDER[right.score?.band ?? "unknown"] ||
        left.site.bortle - right.site.bortle ||
        (right.site.altitude ?? -1) - (left.site.altitude ?? -1) ||
        left.site.name.localeCompare(right.site.name, "zh-CN")
      );
    })
    .slice(0, limit);

  return ranked.map(({ site, score }, index) => ({
    rank: index + 1,
    site,
    score,
    stars: scoreToStars(score?.score),
    reason: recommendationReason(site, score),
  }));
}

export function viewportKey(viewport: MapViewport | null): string {
  if (!viewport) return "";
  return [
    viewport.north,
    viewport.south,
    viewport.east,
    viewport.west,
    viewport.zoom,
  ]
    .map((value) => value.toFixed(4))
    .join("|");
}
