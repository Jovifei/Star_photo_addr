import * as Astronomy from "astronomy-engine";

const GALACTIC_CENTER_RA_HOURS = 17 + 45 / 60 + 40.04 / 3600;
const GALACTIC_CENTER_DEC_DEG = -(29 + 0 / 60 + 28.1 / 3600);
Astronomy.DefineStar(Astronomy.Body.Star1, GALACTIC_CENTER_RA_HOURS, GALACTIC_CENTER_DEC_DEG, 25800);

function horizontal(body, date, observer) {
  const equator = Astronomy.Equator(body, date, observer, true, true);
  return Astronomy.Horizon(date, observer, equator.ra, equator.dec, "normal");
}

export function astronomyAt(date, location) {
  // Map-picked and geocoded locations may not have a terrain elevation yet.
  // Astronomy Engine requires a finite observer height; use sea level for
  // geometry without mutating the location displayed to the user.
  const elevation = Number.isFinite(location.elevation) ? location.elevation : 0;
  const observer = new Astronomy.Observer(location.latitude, location.longitude, elevation);
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

export function moonPhaseName(fraction, waxing = true) {
  if (fraction < 0.03) return "新月";
  if (fraction > 0.97) return "满月";
  if (fraction < 0.45) return waxing ? "娥眉月" : "残月";
  if (fraction < 0.55) return waxing ? "上弦月" : "下弦月";
  return waxing ? "盈凸月" : "亏凸月";
}
