import type { PressureForecastResponse, PressureLevelSample } from "./pressure";
import { PRESSURE_LEVELS } from "./pressureLevels";
import { isValidProviderValue } from "./providerWeatherIntegrity";

/** Pure validation shared by scoring in the browser and server ingestion. */
export function isCompletePressureLevelSample(sample: PressureLevelSample): boolean {
  return (PRESSURE_LEVELS as readonly number[]).includes(sample.pressure) &&
    isValidProviderValue(`cloud_cover_${sample.pressure}hPa`, sample.cloudCover) &&
    isValidProviderValue(`relative_humidity_${sample.pressure}hPa`, sample.humidity) &&
    isValidProviderValue(`temperature_${sample.pressure}hPa`, sample.temperature) &&
    isValidProviderValue(`geopotential_height_${sample.pressure}hPa`, sample.heightMsl);
}

/** Dense temperature/RH/height can bound clear air without making up cloud %. */
export function isThermodynamicPressureLevelSample(sample: PressureLevelSample): boolean {
  return (PRESSURE_LEVELS as readonly number[]).includes(sample.pressure) &&
    (sample.cloudCover == null || isValidProviderValue(`cloud_cover_${sample.pressure}hPa`, sample.cloudCover)) &&
    isValidProviderValue(`relative_humidity_${sample.pressure}hPa`, sample.humidity) &&
    isValidProviderValue(`temperature_${sample.pressure}hPa`, sample.temperature) &&
    isValidProviderValue(`geopotential_height_${sample.pressure}hPa`, sample.heightMsl);
}

export function usablePressureLevelCount(samples: PressureLevelSample[] | null | undefined): number {
  return new Set(samples?.filter(isCompletePressureLevelSample).map(sample => sample.pressure)).size;
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
