// Pressure-level cloud-layer derivation used by observation detail charts.
// The result is model-derived and experimental; it is not a summit measurement.

import type { CloudLayer, PressureLevel } from "./types";

export { PRESSURE_LEVELS } from "./pressureLevels";

export interface TemperatureInversionEvidence {
  status: "detected" | "not-detected" | "unavailable";
  lowerMsl: number | null;
  upperMsl: number | null;
  deltaTempC: number | null;
  strength: "weak" | "moderate" | "strong" | null;
}

export function deriveCloudLayers(
  profile: PressureLevel[],
  modelElevation: number,
  siteElevation: number,
): CloudLayer[] {
  const valid = profile
    .filter((level) => {
      const h = level.heightMsl;
      return h !== undefined && Number.isFinite(h) && h >= modelElevation - 50;
    })
    .sort((a, b) => (a.heightMsl ?? 0) - (b.heightMsl ?? 0))
    .map((level) => ({
      ...level,
      cloudy: (level.cloudCover ?? 0) >= 55 || (level.humidity ?? 0) >= 90,
    }));
  const layers: PressureLevel[][] = [];
  let current: PressureLevel[] = [];
  valid.forEach((level) => {
    if (level.cloudy) current.push(level);
    else if (current.length) {
      layers.push(current);
      current = [];
    }
  });
  if (current.length) layers.push(current);

  return layers.map((levels) => {
    const baseMsl = Math.round((levels[0].heightMsl ?? 0) / 50) * 50;
    const topMsl = Math.round((levels.at(-1)?.heightMsl ?? 0) / 50) * 50;
    const margin = 150;
    const relation: CloudLayer["relation"] =
      siteElevation > topMsl + margin
        ? "云上"
        : siteElevation >= baseMsl - margin && siteElevation <= topMsl + margin
          ? "云中"
          : "云下";
    return {
      baseMsl,
      topMsl,
      baseAgl: Math.max(0, baseMsl - modelElevation),
      topAgl: Math.max(0, topMsl - modelElevation),
      relation,
      confidence: (levels.length >= 2 ? "中" : "低") as CloudLayer["confidence"],
      levels,
    };
  });
}

/**
 * Detect low/mid-tropospheric temperature-inversion evidence from adjacent
 * model pressure levels. This is numerical-model evidence, not radiosonde or
 * summit-sensor observation.
 */
export function detectTemperatureInversion(
  profile: PressureLevel[],
  modelElevation: number,
  maxHeightMsl = Number.POSITIVE_INFINITY,
): TemperatureInversionEvidence {
  const valid = profile
    .filter((level) => {
      const height = level.heightMsl;
      const temperature = level.temperature;
      return (
        height !== undefined &&
        temperature !== undefined &&
        Number.isFinite(height) &&
        Number.isFinite(temperature) &&
        height >= modelElevation - 50 &&
        height <= maxHeightMsl
      );
    })
    .sort((a, b) => (a.heightMsl ?? 0) - (b.heightMsl ?? 0));

  if (valid.length < 2) {
    return {
      status: "unavailable",
      lowerMsl: null,
      upperMsl: null,
      deltaTempC: null,
      strength: null,
    };
  }

  let strongest:
    | { lowerMsl: number; upperMsl: number; deltaTempC: number }
    | null = null;
  for (let index = 0; index < valid.length - 1; index += 1) {
    const lower = valid[index]!;
    const upper = valid[index + 1]!;
    const lowerMsl = lower.heightMsl!;
    const upperMsl = upper.heightMsl!;
    const heightDelta = upperMsl - lowerMsl;
    if (heightDelta <= 0) continue;
    const deltaTempC = upper.temperature! - lower.temperature!;
    if (!strongest || deltaTempC > strongest.deltaTempC) {
      strongest = { lowerMsl, upperMsl, deltaTempC };
    }
  }

  if (!strongest) {
    return {
      status: "unavailable",
      lowerMsl: null,
      upperMsl: null,
      deltaTempC: null,
      strength: null,
    };
  }
  if (strongest.deltaTempC < 0.5) {
    return {
      status: "not-detected",
      lowerMsl: null,
      upperMsl: null,
      deltaTempC: null,
      strength: null,
    };
  }

  const roundedDelta = Math.round(strongest.deltaTempC * 10) / 10;
  const strength: TemperatureInversionEvidence["strength"] =
    roundedDelta >= 3 ? "strong" : roundedDelta >= 1.5 ? "moderate" : "weak";
  return {
    status: "detected",
    lowerMsl: Math.round(strongest.lowerMsl),
    upperMsl: Math.round(strongest.upperMsl),
    deltaTempC: roundedDelta,
    strength,
  };
}
