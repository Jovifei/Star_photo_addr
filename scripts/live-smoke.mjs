import { PRESET_LOCATIONS } from "../src/data/locations.js";
import { fetchPressureForecast, fetchSurfaceForecasts } from "../src/lib/openMeteo.js";

const locations = PRESET_LOCATIONS.slice(0, 2);
const surface = await fetchSurfaceForecasts(locations, 2);
if (surface.length !== 2 || surface.some((item) => item.hourly.length < 24)) {
  throw new Error("Open-Meteo surface response is incomplete");
}
const pressure = await fetchPressureForecast(locations[0], 1);
const firstProfile = Object.values(pressure.profiles)[0];
if (!firstProfile || firstProfile.length < 8) throw new Error("Open-Meteo pressure profile is incomplete");
console.log(
  JSON.stringify(
    {
      provider: "Open-Meteo",
      locations: surface.length,
      surfaceHours: surface[0].hourly.length,
      pressureLevels: firstProfile.length,
      fetchedAt: surface[0].fetchedAt,
    },
    null,
    2,
  ),
);
