// Deterministic Open-Meteo mock for flake-free E2E.
// Synthesizes raw Open-Meteo responses from a real captured fixture so the
// browser app receives contract-correct data without depending on the live API.
import { PRESSURE_LEVELS } from "../../src/lib/clouds.js";

const SURFACE_RAW = [
  ["temperature_2m", "temperature"],
  ["relative_humidity_2m", "humidity"],
  ["dew_point_2m", "dewPoint"],
  ["precipitation_probability", "precipitationProbability"],
  ["precipitation", "precipitation"],
  ["weather_code", "weatherCode"],
  ["cloud_cover", "cloudCover"],
  ["cloud_cover_low", "cloudLow"],
  ["cloud_cover_mid", "cloudMid"],
  ["cloud_cover_high", "cloudHigh"],
  ["visibility", "visibility"],
  ["wind_speed_10m", "windSpeed"],
  ["wind_gusts_10m", "windGust"],
];

const CLOUD_FIELDS = new Set(["cloudCover", "cloudLow", "cloudMid", "cloudHigh"]);

function perturb(field, value, offset) {
  if (value == null) return value;
  if (CLOUD_FIELDS.has(field)) {
    return Math.max(0, Math.min(100, Math.round(value + offset)));
  }
  return value;
}

function buildSurfaceRaw(fixture, lats, lons, days) {
  const src = fixture.surface.hourly.slice(0, days * 24);
  const baseElev = fixture.surface.modelElevation;
  return lats.map((lat, i) => {
    const offset = ((i * 7 + 3) % 50) - 25; // -25..24, deterministic per location
    const hourly = { time: src.map((r) => r.time) };
    for (const [raw, field] of SURFACE_RAW) {
      hourly[raw] = src.map((r) => perturb(field, r[field], offset));
    }
    return {
      latitude: Number(lat),
      longitude: Number(lons[i] ?? lat),
      elevation: baseElev + i * 7,
      timezone: "Asia/Shanghai",
      timezone_abbreviation: "CST",
      utc_offset_seconds: 28800,
      generationtime_ms: 0.1,
      hourly_units: {},
      hourly,
    };
  });
}

function buildPressureRaw(fixture, days) {
  const src = fixture.pressure.hourly.slice(0, days * 24);
  const profiles = fixture.pressure.profiles;
  const times = src.map((r) => r.time);
  const hourly = { time: times };
  for (const [raw, field] of SURFACE_RAW) {
    hourly[raw] = src.map((r) => r[field]);
  }
  for (const level of PRESSURE_LEVELS) {
    hourly[`cloud_cover_${level}hPa`] = times.map(
      (t) => profiles[t]?.find((p) => p.pressure === level)?.cloudCover ?? null,
    );
    hourly[`relative_humidity_${level}hPa`] = times.map(
      (t) => profiles[t]?.find((p) => p.pressure === level)?.humidity ?? null,
    );
    hourly[`temperature_${level}hPa`] = times.map(
      (t) => profiles[t]?.find((p) => p.pressure === level)?.temperature ?? null,
    );
    hourly[`geopotential_height_${level}hPa`] = times.map(
      (t) => profiles[t]?.find((p) => p.pressure === level)?.heightMsl ?? null,
    );
  }
  return {
    latitude: fixture.pressure.modelLatitude ?? 30,
    longitude: fixture.pressure.modelLongitude ?? 119,
    elevation: fixture.pressure.modelElevation,
    timezone: "Asia/Shanghai",
    timezone_abbreviation: "CST",
    utc_offset_seconds: 28800,
    generationtime_ms: 0.1,
    hourly_units: {},
    hourly,
  };
}

export async function installOpenMeteoMock(page, fixture) {
  await page.route("**/api.open-meteo.com/v1/forecast**", async (route) => {
    const url = new URL(route.request().url());
    const lats = (url.searchParams.get("latitude") || "").split(",").filter(Boolean);
    const lons = (url.searchParams.get("longitude") || "").split(",").filter(Boolean);
    const days = Math.min(16, Math.max(1, Number(url.searchParams.get("forecast_days")) || 14));
    const hourly = url.searchParams.get("hourly") || "";
    const isPressure = hourly.includes("cloud_cover_1000hPa");
    if (isPressure) {
      const body = buildPressureRaw(fixture, days);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    } else {
      const bodies = buildSurfaceRaw(fixture, lats, lons, days);
      const payload = bodies.length > 1 ? bodies : bodies[0];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
    }
  });
}
