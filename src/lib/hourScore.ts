import { hourInstantMs } from "./absoluteForecastTime";
import { astronomyAt } from "./astronomy";
import {
  missingNightInputs,
  scoreCoreWeather,
} from "./forecastIntegrity";
import type { HourEvaluation, HourWeather, Location } from "./types";

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value));
export const NOT_DARK_BLOCKER = "未达天文暗夜（太阳高度高于 -18°）";

/** One canonical weather + astronomy hour score shared by map and detail views. */
export function scoreHour(
  hour: HourWeather,
  location: Location,
  utcOffsetSeconds: number,
): HourEvaluation | null {
  if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90 ||
      !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180 ||
      (location.elevation != null && !Number.isFinite(location.elevation))) return null;
  if (missingNightInputs(hour).length) return null;
  const core = scoreCoreWeather(hour);
  if (!core) return null;
  let astro;
  try {
    astro = astronomyAt(new Date(hourInstantMs(hour, utcOffsetSeconds)), location);
  } catch {
    return null;
  }
  if (![astro.sunAltitude, astro.moonAltitude, astro.moonIllumination].every(Number.isFinite)) return null;
  const darkness = astro.sunAltitude <= -18
    ? 100
    : astro.sunAltitude >= -12
      ? 0
      : ((-12 - astro.sunAltitude) / 6) * 100;
  const moonAltitudeFactor = clamp((astro.moonAltitude + 5) / 50, 0, 1);
  const moonlight = clamp(100 - astro.moonIllumination * moonAltitudeFactor * 100);
  const rawScore = Math.round(core.weatherScore * 0.7 + darkness * 0.15 + moonlight * 0.15);
  const notDark = astro.sunAltitude > -18;
  const blockers = notDark ? [...core.blockers, NOT_DARK_BLOCKER] : core.blockers;
  // Clear weather cannot make daylight or twilight a dark-sky recommendation.
  // Preserve the weather components and explain the astronomical limitation.
  const score = notDark
    ? Math.min(astro.sunAltitude >= -12 ? 39 : 69, rawScore)
    : core.blockers.includes("总云或分层云覆盖偏高") ? Math.min(69, rawScore) : rawScore;
  const quality: HourEvaluation["quality"] = blockers.length
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
    blockers,
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
