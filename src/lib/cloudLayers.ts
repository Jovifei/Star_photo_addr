// Pressure-level cloud-layer derivation (ported from star-weather's clouds.js).
// Used by the observation detail to summarise where cloud decks sit relative to
// the observer (experimental, model-derived, not a summit measurement).

import type { CloudLayer, PressureLevel } from "./types";

export const PRESSURE_LEVELS = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500];

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
