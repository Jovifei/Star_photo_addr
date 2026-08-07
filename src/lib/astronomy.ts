// Astronomy calculations (ported from star-weather's astronomy.js to TypeScript,
// using astronomy-engine). Provides sun/moon/galactic-centre altitudes and the
// moon-phase name used by the scoring engine.

import * as Astronomy from "astronomy-engine";
import type { Location } from "./types";

const GALACTIC_CENTER_RA_HOURS = 17 + 45 / 60 + 40.04 / 3600;
const GALACTIC_CENTER_DEC_DEG = -(29 + 0 / 60 + 28.1 / 3600);
Astronomy.DefineStar(
  Astronomy.Body.Star1,
  GALACTIC_CENTER_RA_HOURS,
  GALACTIC_CENTER_DEC_DEG,
  25800,
);

function horizontal(body: Astronomy.Body, date: Date, observer: Astronomy.Observer) {
  const equator = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");
}

export interface AstronomyResult {
  sunAltitude: number;
  sunAzimuth: number;
  moonAltitude: number;
  moonAzimuth: number;
  moonIllumination: number;
  galacticAltitude: number;
  galacticAzimuth: number;
}

export function astronomyAt(date: Date, location: Location): AstronomyResult {
  const observer = new Astronomy.Observer(
    location.latitude,
    location.longitude,
    location.elevation,
  );
  const sun = horizontal(Astronomy.Body.Sun, date, observer);
  const moon = horizontal(Astronomy.Body.Moon, date, observer);
  const galacticCenter = horizontal(Astronomy.Body.Star1, date, observer);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, date);
  return {
    sunAltitude: sun.altitude,
    sunAzimuth: sun.azimuth,
    moonAltitude: moon.altitude,
    moonAzimuth: moon.azimuth,
    moonIllumination: illumination.phase_fraction,
    galacticAltitude: galacticCenter.altitude,
    galacticAzimuth: galacticCenter.azimuth,
  };
}

export function moonPhaseName(fraction: number, waxing = true): string {
  if (fraction < 0.03) return "新月";
  if (fraction > 0.97) return "满月";
  if (fraction < 0.45) return waxing ? "娥眉月" : "残月";
  if (fraction < 0.55) return waxing ? "上弦月" : "下弦月";
  return waxing ? "盈凸月" : "亏凸月";
}
