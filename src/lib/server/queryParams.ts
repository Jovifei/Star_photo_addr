export interface CoordinatePair {
  latitude: number;
  longitude: number;
}

export interface CoordinateLists {
  latitudes: number[];
  longitudes: number[];
}

type SearchParamsLike = Pick<URLSearchParams, "get">;

function firstParam(
  searchParams: SearchParamsLike,
  names: readonly string[],
): string | null {
  for (const name of names) {
    const value = searchParams.get(name);
    if (value !== null) return value;
  }
  return null;
}

function parseCoordinate(
  raw: string | null,
  minimum: number,
  maximum: number,
): number | null {
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    return null;
  }
  return Object.is(value, -0) ? 0 : value;
}

function parseCoordinateList(
  raw: string | null,
  minimum: number,
  maximum: number,
  maxLocations: number,
): number[] | null {
  if (raw === null || raw.trim() === "") return null;
  const tokens = raw.split(",");
  if (
    tokens.length === 0 ||
    tokens.length > maxLocations ||
    tokens.some((token) => token.trim() === "")
  ) {
    return null;
  }
  const values = tokens.map((token) =>
    parseCoordinate(token, minimum, maximum),
  );
  return values.every((value): value is number => value !== null)
    ? values
    : null;
}

/** Parse one coordinate pair while accepting the public long and short names. */
export function parseCoordinatePair(
  searchParams: SearchParamsLike,
): CoordinatePair | null {
  const latitude = parseCoordinate(
    firstParam(searchParams, ["latitude", "lat"]),
    -90,
    90,
  );
  const longitude = parseCoordinate(
    firstParam(searchParams, ["longitude", "lng"]),
    -180,
    180,
  );
  return latitude === null || longitude === null
    ? null
    : { latitude, longitude };
}

/**
 * Parse aligned coordinate lists. Empty tokens are rejected instead of being
 * coerced by `Number("")` to the valid-looking coordinate 0.
 */
export function parseCoordinateLists(
  searchParams: SearchParamsLike,
  maxLocations: number,
): CoordinateLists | null {
  const latitudes = parseCoordinateList(
    firstParam(searchParams, ["latitude", "lat"]),
    -90,
    90,
    maxLocations,
  );
  const longitudes = parseCoordinateList(
    firstParam(searchParams, ["longitude", "lng"]),
    -180,
    180,
    maxLocations,
  );
  return latitudes &&
    longitudes &&
    latitudes.length === longitudes.length
    ? { latitudes, longitudes }
    : null;
}
