import type { PressureLevelSample } from "./pressure";

/** Pure validation shared by scoring in the browser and server ingestion. */
export function isCompletePressureLevelSample(sample: PressureLevelSample): boolean {
  return Number.isFinite(sample.pressure) &&
    sample.cloudCover !== null && Number.isFinite(sample.cloudCover) &&
    sample.humidity !== null && Number.isFinite(sample.humidity) &&
    sample.temperature !== null && Number.isFinite(sample.temperature) &&
    sample.heightMsl !== null && Number.isFinite(sample.heightMsl);
}

export function usablePressureLevelCount(samples: PressureLevelSample[] | null | undefined): number {
  return samples ? samples.filter(isCompletePressureLevelSample).length : 0;
}

export function hasUsablePressureProfile(samples: PressureLevelSample[] | null | undefined, minimumLevels = 6): boolean {
  return usablePressureLevelCount(samples) >= minimumLevels;
}
