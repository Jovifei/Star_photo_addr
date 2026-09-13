import { astronomyAt } from "./astronomy";
import { parseProviderTime } from "./nighttime";
import {
  missingNightInputs,
  scoreCoreWeather,
} from "./forecastIntegrity";
import type { HourEvaluation, HourWeather, Location } from "./types";

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));

/** One canonical weather + astronomy hour score shared by map and detail views. */
export function scoreHour(
  hour: HourWeather,
  location: Location,
  utcOffsetSeconds: number,
): HourEvaluation | null {
  if (missingNightInputs(hour).length) return null;
  const core = scoreCoreWeather(hour);
  if (!core) return null;
  let astro;
  try {
    astro = astronomyAt(parseProviderTime(hour.time, utcOffsetSeconds), location);
  } catch {
    return null;
  }
  const darkness = astro.sunAltitude <= -18
    ? 100
    : astro.sunAltitude >= -12
      ? 0
      : ((-12 - astro.sunAltitude) / 6) * 100;
  const moonAltitudeFactor = clamp((astro.moonAltitude + 5) / 50, 0, 1);
  const moonlight = clamp(100 - astro.moonIllumination * moonAltitudeFactor * 100);
  const rawScore = Math.round(core.weatherScore * 0.7 + darkness * 0.15 + moonlight * 0.15);
  // A substantial cloud layer is a hard recommendation blocker even when a
  // single astronomy component would otherwise lift the numeric score.
  const score = core.blockers.includes("总云或分层云覆盖偏高")
    ? Math.min(69, rawScore)
    : rawScore;
  const quality: HourEvaluation["quality"] = core.blockers.length
    ? "blocked"
    : score >= 76
      ? "excellent"
      : score >= 62
        ? "candidate"
        : "poor";
  return {
    ...hour,
    ...astro,
    score,
    quality,
    blockers: core.blockers,
    components: {
      clearSky: core.clearSky,
      precipitation: core.precipitation,
      transparency: core.transparency,
      wind: core.wind,
      darkness,
      moonlight,
    },
    scoreBasis: "astronomy-weather-hour",
    scoreTime: hour.time,
    effectiveCloudForScore: core.effectiveCloudForScore,
    weatherRisk: core.weatherRisk,
  };
}
