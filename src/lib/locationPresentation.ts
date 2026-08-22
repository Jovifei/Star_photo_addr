import {
  OBSERVING_SITES,
  snapshotScoreAtTime,
} from "@/lib/observingSites";
import type {
  ObservationSnapshot,
  ObservingSite,
  RecommendationScore,
} from "@/lib/types";

const EARTH_RADIUS_KM = 6371.0088;

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export interface RankedNearbySite {
  site: ObservingSite;
  distanceKm: number;
  score: RecommendationScore | null;
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180;
}

/** Great-circle distance suitable for radius filtering and user-facing ranges. */
export function haversineDistanceKm(
  first: CoordinatePoint,
  second: CoordinatePoint,
): number {
  const latitudeDelta = degreesToRadians(
    second.latitude - first.latitude,
  );
  const longitudeDelta = degreesToRadians(
    second.longitude - first.longitude,
  );
  const firstLatitude = degreesToRadians(first.latitude);
  const secondLatitude = degreesToRadians(second.latitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Normalize elevation to metres and reject impossible values.
 *
 * A few imported sources historically used centimetres. Values above the
 * terrestrial range but below 900,000 are treated as centimetres; anything
 * still outside -500..9000 m is marked unknown instead of being displayed.
 */
export function normalizeElevationMeters(
  value: number | null | undefined,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const metres = Math.abs(value) > 9000 && Math.abs(value) <= 900_000
    ? value / 100
    : value;
  if (metres < -500 || metres > 9000) return null;
  return Math.round(metres);
}

export function formatElevationMeters(
  value: number | null | undefined,
): string {
  const metres = normalizeElevationMeters(value);
  return metres === null ? "海拔待核验" : `海拔 ${metres.toLocaleString("zh-CN")} m`;
}

export function nearestObservingSite(
  latitude: number,
  longitude: number,
): { site: ObservingSite; distanceKm: number } | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  let nearest: { site: ObservingSite; distanceKm: number } | null = null;
  for (const site of OBSERVING_SITES) {
    const distanceKm = haversineDistanceKm(
      { latitude, longitude },
      site,
    );
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { site, distanceKm };
    }
  }
  return nearest;
}

/** Give map-click samples a useful, honest label without pretending to reverse-geocode. */
export function describeSamplePoint(
  latitude: number,
  longitude: number,
): string {
  const nearest = nearestObservingSite(latitude, longitude);
  if (nearest && nearest.distanceKm <= 120) {
    const area = nearest.site.area ? ` · ${nearest.site.area}` : "";
    return `${nearest.site.province}${area}附近取样点`;
  }
  return `取样点 · ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

export function rankNearbySites(
  center: CoordinatePoint,
  radiusKm: number,
  snapshot: ObservationSnapshot | null | undefined,
  limit = 10,
): RankedNearbySite[] {
  const safeRadius = Math.min(500, Math.max(1, radiusKm));
  return OBSERVING_SITES.map((site) => ({
    site,
    distanceKm: haversineDistanceKm(center, site),
    score: snapshotScoreAtTime(snapshot, site.id),
  }))
    .filter((item) => item.distanceKm <= safeRadius)
    .sort((left, right) => {
      const leftScore = left.score?.score ?? -1;
      const rightScore = right.score?.score ?? -1;
      return (
        rightScore - leftScore ||
        left.distanceKm - right.distanceKm ||
        left.site.bortle - right.site.bortle ||
        (normalizeElevationMeters(right.site.altitude) ?? -1) -
          (normalizeElevationMeters(left.site.altitude) ?? -1) ||
        left.site.name.localeCompare(right.site.name, "zh-CN")
      );
    })
    .slice(0, Math.max(1, limit));
}
