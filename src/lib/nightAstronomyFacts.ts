import { astronomyAt, moonPhaseName } from "./astronomy";
import { forecastTrustIssue } from "./forecastIntegrity";
import { isInNight, parseProviderTime } from "./nighttime";
import type { Location, LocationForecast } from "./types";

export interface NightAstronomyFacts {
  moonIllumination: number;
  moonPhase: string;
  /** Elapsed darkness estimate integrated between adjacent hourly samples. */
  darkHours: number;
  galacticMax: number;
  sampleCount: number;
  heightAssumption: "provided" | "sea-level";
}

/** Fraction of an interval below astronomical twilight, assuming linear altitude. */
function darkIntervalFraction(startAltitude: number, endAltitude: number): number {
  const startDark = startAltitude <= -18;
  const endDark = endAltitude <= -18;
  if (startDark && endDark) return 1;
  if (!startDark && !endDark) return 0;
  const crossing = (-18 - startAltitude) / (endAltitude - startAltitude);
  return startDark ? crossing : 1 - crossing;
}

/** Geometric hourly samples, independent of weather qualification. Uses the current
 * provider fixed-offset contract; DST canonical instants require a later migration.
 * Reject stale/pre-offset fallbacks rather than trusting their guessed clock. */
export function nightAstronomyFacts(
  forecast: LocationForecast | null,
  location: Location | null,
  nightKey: string,
  now = Date.now(),
): NightAstronomyFacts | null {
  if (
    !forecast || !location || forecast.locationId !== location.id ||
    forecastTrustIssue(forecast, now) ||
    !Number.isFinite(forecast.utcOffsetSeconds) ||
    Math.abs(forecast.utcOffsetSeconds) > 50400 || !forecast.timezone ||
    !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
    !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180
  ) return null;

  const hours = forecast.hourly
    .filter(hour => isInNight(hour.time, nightKey))
    .sort((a, b) => a.time.localeCompare(b.time));
  if (hours.length < 7 || new Set(hours.map(hour => hour.time)).size !== hours.length) return null;

  try {
    // Require an actual IANA identity even while the provider API uses one offset.
    new Intl.DateTimeFormat("en-US", {timeZone: forecast.timezone}).format(new Date(now));
    const samples = hours.map(hour => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(hour.time)) {
        throw new Error("Invalid provider clock");
      }
      const instant = parseProviderTime(hour.time, forecast.utcOffsetSeconds);
      if (!Number.isFinite(instant.getTime())) throw new Error("Invalid provider time");
      return { instantMs: instant.getTime(), ...astronomyAt(instant, location) };
    });
    let darkHours = 0;
    for (let index = 1; index < samples.length; index += 1) {
      const start = samples[index - 1]!;
      const end = samples[index]!;
      const intervalHours = (end.instantMs - start.instantMs) / 3_600_000;
      // Missing hours are unknown intervals, not implied uninterrupted darkness.
      if (intervalHours <= 0 || intervalHours > 1) continue;
      darkHours += intervalHours * darkIntervalFraction(start.sunAltitude, end.sunAltitude);
    }
    const moon = samples[Math.floor(samples.length / 2)]!;
    return {
      moonIllumination: moon.moonIllumination,
      moonPhase: moonPhaseName(moon.moonIllumination, moon.moonPhaseAngle),
      darkHours: Math.round(darkHours * 10) / 10,
      galacticMax: Math.round(Math.max(...samples.map(sample => sample.galacticAltitude))),
      sampleCount: samples.length,
      heightAssumption: location.elevation != null && Number.isFinite(location.elevation)
        ? "provided" : "sea-level",
    };
  } catch {
    return null;
  }
}
