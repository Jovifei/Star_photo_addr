export interface AirQualityPoint {
  time: string;
  usAqi: number;
}

export interface KpPoint {
  time: string;
  kp: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function localWallClockMs(value: string): number {
  const normalized = value.length === 16 ? `${value}:00` : value;
  return Date.parse(`${normalized}Z`);
}

function utcInstantMs(value: string): number {
  const normalized = value.trim().replace(" ", "T");
  if (!normalized) return Number.NaN;
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  return Date.parse(hasTimeZone ? normalized : `${normalized}Z`);
}

export function parseAirQualityPoints(payload: unknown): AirQualityPoint[] {
  if (!isRecord(payload) || !Array.isArray(payload.hourly)) return [];
  return payload.hourly.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.time !== "string" ||
      !entry.time.trim()
    ) {
      return [];
    }
    const usAqi = finiteNumber(entry.usAqi);
    return usAqi === null || usAqi < 0 || usAqi > 500
      ? []
      : [{ time: entry.time, usAqi }];
  });
}

export function parseKpPoints(payload: unknown): KpPoint[] {
  if (!isRecord(payload) || !Array.isArray(payload.frames)) return [];
  return payload.frames.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.time !== "string" ||
      !entry.time.trim()
    ) {
      return [];
    }
    const kp = finiteNumber(entry.kp);
    return kp === null || kp < 0 || kp > 9
      ? []
      : [{ time: entry.time, kp }];
  });
}

export function nearestAirQualityValue(
  points: AirQualityPoint[],
  targetTime: string | null | undefined,
  maxDistanceMs = 90 * 60 * 1000,
): number | null {
  if (!points.length) return null;
  if (!targetTime) return points[0]?.usAqi ?? null;
  const exact = points.find((point) => point.time === targetTime);
  if (exact) return exact.usAqi;
  const target = localWallClockMs(targetTime);
  if (!Number.isFinite(target)) return points[0]?.usAqi ?? null;

  let nearest: AirQualityPoint | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const instant = localWallClockMs(point.time);
    if (!Number.isFinite(instant)) continue;
    const nextDistance = Math.abs(instant - target);
    if (nextDistance < distance) {
      nearest = point;
      distance = nextDistance;
    }
  }
  return nearest && distance <= maxDistanceMs ? nearest.usAqi : null;
}

export function nearestKpValue(
  points: KpPoint[],
  targetInstantMs: number,
  maxDistanceMs = 3 * 60 * 60 * 1000,
): number | null {
  if (!points.length) return null;
  const target = Number.isFinite(targetInstantMs)
    ? targetInstantMs
    : Date.now();
  let nearest: KpPoint | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const point of points) {
    const instant = utcInstantMs(point.time);
    if (!Number.isFinite(instant)) continue;
    const nextDistance = Math.abs(instant - target);
    if (nextDistance < distance) {
      nearest = point;
      distance = nextDistance;
    }
  }
  return nearest && distance <= maxDistanceMs ? nearest.kp : null;
}
