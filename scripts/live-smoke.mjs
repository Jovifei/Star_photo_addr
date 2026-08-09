// Provider smoke test. Browser traffic uses the same-origin route handlers;
// this standalone check talks to the upstream provider directly so it does
// not require a dev server to be running.
import { PRESET_LOCATIONS } from "../src/features/planner/data/locations.js";

const locations = PRESET_LOCATIONS.slice(0, 2);
const variables = [
  "temperature_2m", "relative_humidity_2m", "dew_point_2m",
  "precipitation_probability", "precipitation", "weather_code",
  "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high",
  "visibility", "wind_speed_10m", "wind_gusts_10m", "wind_direction_10m",
];
const params = new URLSearchParams({
  latitude: locations.map((item) => item.latitude).join(","),
  longitude: locations.map((item) => item.longitude).join(","),
  hourly: variables.join(","), timezone: "auto", forecast_days: "2", wind_speed_unit: "ms",
});
const surfaceResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
if (!surfaceResponse.ok) throw new Error(`Open-Meteo surface returned ${surfaceResponse.status}`);
const surfacePayload = await surfaceResponse.json();
const surface = Array.isArray(surfacePayload) ? surfacePayload : [surfacePayload];
if (surface.length !== 2 || surface.some((item) => !item.hourly?.time?.length || !Array.isArray(item.hourly.wind_direction_10m))) {
  throw new Error("Open-Meteo surface response is incomplete");
}

const pressureLevels = [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500];
const pressureVariables = pressureLevels.flatMap((level) => [`cloud_cover_${level}hPa`, `relative_humidity_${level}hPa`, `temperature_${level}hPa`, `geopotential_height_${level}hPa`]);
const pressureParams = new URLSearchParams({
  latitude: String(locations[0].latitude), longitude: String(locations[0].longitude),
  hourly: [...variables, ...pressureVariables].join(","), timezone: "auto", forecast_days: "1", wind_speed_unit: "ms",
});
const pressureResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${pressureParams}`);
if (!pressureResponse.ok) throw new Error(`Open-Meteo pressure returned ${pressureResponse.status}`);
const pressure = await pressureResponse.json();
const firstTime = pressure.hourly?.time?.[0];
const firstProfile = pressureLevels.filter((level) => Array.isArray(pressure.hourly?.[`cloud_cover_${level}hPa`]) && pressure.hourly[`cloud_cover_${level}hPa`].length).length;
if (!firstTime || firstProfile < 8) throw new Error("Open-Meteo pressure profile is incomplete");

console.log(JSON.stringify({ provider: "Open-Meteo", locations: surface.length, surfaceHours: surface[0].hourly.time.length, pressureLevels: firstProfile, fetchedAt: new Date().toISOString() }, null, 2));
