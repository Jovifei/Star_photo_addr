import type { PressureForecastResponse, PressureLevelSample } from "./pressure";

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

/** Exact epoch lookup for versioned profiles; old ISO remains display-only. */
export function pressureProfileAt(
  pressure: Pick<PressureForecastResponse, "hourly" | "profiles" | "profilesByEpoch" | "timeAxisVersion"> | null | undefined,
  time: string,
  epochSeconds?: number | null,
): PressureLevelSample[] | null {
  if (!pressure) return null;
  if (pressure.timeAxisVersion === "epoch-v1") {
    const hour = pressure.hourly.find(hour => hour.time === time && (epochSeconds == null || hour.epochSeconds === epochSeconds));
    return hour?.epochSeconds == null ? null : pressure.profilesByEpoch?.[String(hour.epochSeconds)] ?? null;
  }
  return pressure.profiles[time] ?? pressure.profiles[time.slice(0, 16)] ?? null;
}
