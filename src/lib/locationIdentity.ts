/**
 * Stable identity helpers for user-selected and curated locations.
 *
 * IDs are source-specific, so the same physical point can legitimately arrive
 * with different IDs (map sample, curated site, planner deep link). Coordinates
 * are therefore the final identity boundary. Five decimal places are about one
 * metre in latitude, narrow enough to avoid collapsing nearby but distinct
 * viewpoints while still deduplicating the exact same sampled station.
 */
export interface CoordinateIdentity {
  id?: string | null;
  latitude: number;
  longitude: number;
}

export const LOCATION_IDENTITY_PRECISION = 5;

export function coordinateIdentityKey(
  value: CoordinateIdentity | null | undefined,
): string | null {
  if (
    !value ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    return null;
  }
  return `${value.latitude.toFixed(LOCATION_IDENTITY_PRECISION)},${value.longitude.toFixed(LOCATION_IDENTITY_PRECISION)}`;
}

export function sameLocationIdentity(
  left: CoordinateIdentity | null | undefined,
  right: CoordinateIdentity | null | undefined,
): boolean {
  if (!left || !right) return false;
  const leftKey = coordinateIdentityKey(left);
  return leftKey !== null && leftKey === coordinateIdentityKey(right);
}

/** Preserve the first (highest-priority) record for each ID/coordinate pair. */
export function dedupeLocationIdentities<T extends CoordinateIdentity>(
  values: readonly T[],
): T[] {
  const coordinates = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const coordinateKey = coordinateIdentityKey(value);
    if (!coordinateKey) continue;
    if (coordinates.has(coordinateKey)) {
      continue;
    }
    coordinates.add(coordinateKey);
    result.push(value);
  }
  return result;
}

export function stableSampleLocationId(
  latitude: number,
  longitude: number,
): string {
  return `custom-${latitude.toFixed(LOCATION_IDENTITY_PRECISION)}-${longitude.toFixed(LOCATION_IDENTITY_PRECISION)}`;
}

export type LocationSourceScope = "observing" | "cloudsea" | "coordinate";
export interface IdentityPoint { id?: string; name: string; latitude: number; longitude: number; }
export interface LocationIdentity extends IdentityPoint {
  version: 1;
  canonicalId: string;
  sourceScope: LocationSourceScope;
  sourceId: string | null;
}
export function coordinateDistanceKm(a: IdentityPoint, b: IdentityPoint): number {
  const radians = Math.PI / 180;
  const x = Math.sin((b.latitude - a.latitude) * radians / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) *
    Math.sin((b.longitude - a.longitude) * radians / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function validIdentityCoordinates(point: Pick<IdentityPoint, "latitude" | "longitude">): boolean {
  return Number.isFinite(point.latitude) && Number.isFinite(point.longitude) &&
    Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180;
}
export function locationIdentity(point: IdentityPoint, sourceScope: LocationSourceScope): LocationIdentity {
  if (!validIdentityCoordinates(point)) throw new Error("地点身份缺少合法坐标");
  const sourceId = point.id ?? null;
  return { ...point, version: 1, sourceScope, sourceId,
    canonicalId: sourceId ? sourceScope + ":" + sourceId : "coordinate:" + point.latitude + "," + point.longitude };
}
/** Names/IDs identify candidates, never prove that conflicting coordinates are one place. */
export function resolveLocationTransfer<T extends IdentityPoint>(
  identity: LocationIdentity, catalogue: readonly T[], scope: LocationSourceScope,
): { status: "matched" | "conflict" | "coordinate"; site: T | null; distanceKm: number | null } {
  if (!validIdentityCoordinates(identity)) return { status: "conflict", site: null, distanceKm: null };
  const related = catalogue.filter(site => site.name === identity.name ||
    (identity.sourceScope === scope && site.id === identity.sourceId) ||
    identity.canonicalId === scope + ":" + site.id);
  const distances = related.map(site => coordinateDistanceKm(identity, site));
  // Catalogue points are exact selections, not weather-model grid centres.
  if (distances.some(distance => !Number.isFinite(distance) || distance > 0.1)) {
    return { status: "conflict", site: null, distanceKm: Math.max(...distances) };
  }
  return related.length === 1
    ? { status: "matched", site: related[0], distanceKm: distances[0] }
    : { status: "coordinate", site: null, distanceKm: null };
}
export function readLocationIdentity(params: Pick<URLSearchParams, "get">): LocationIdentity | null {
  const lat = params.get("lat"), lng = params.get("lng");
  if (!lat?.trim() || !lng?.trim()) return null;
  const source = params.get("sourceScope");
  const scope: LocationSourceScope = source === "observing" || source === "cloudsea" ? source : "coordinate";
  try {
    const identity = locationIdentity({ name: params.get("name")?.trim() || "所选坐标",
      latitude: Number(lat), longitude: Number(lng), id: params.get("sourceId") || undefined }, scope);
    // Retain incoming assertion for conflict checks, not as an override.
    return { ...identity, canonicalId: params.get("canonicalId") || identity.canonicalId };
  } catch { return null; }
}
