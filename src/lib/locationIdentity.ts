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
  if (left.id && right.id && left.id === right.id) return true;
  const leftKey = coordinateIdentityKey(left);
  return leftKey !== null && leftKey === coordinateIdentityKey(right);
}

/** Preserve the first (highest-priority) record for each ID/coordinate pair. */
export function dedupeLocationIdentities<T extends CoordinateIdentity>(
  values: readonly T[],
): T[] {
  const ids = new Set<string>();
  const coordinates = new Set<string>();
  const result: T[] = [];

  for (const value of values) {
    const coordinateKey = coordinateIdentityKey(value);
    if (!coordinateKey) continue;
    if ((value.id && ids.has(value.id)) || coordinates.has(coordinateKey)) {
      continue;
    }
    if (value.id) ids.add(value.id);
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
