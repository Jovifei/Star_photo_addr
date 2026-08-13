// Deterministic Open-Meteo mock for flake-free E2E.
// Synthesizes raw Open-Meteo responses from a real captured fixture so the
// browser app receives contract-correct data without depending on the live API.
import { PRESSURE_LEVELS } from "../../src/features/planner/lib/clouds.js";

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

function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

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

function buildNormalizedForecasts(fixture, lats, lons, days, model = "icon") {
  // Keep the deterministic fixture anchored to the repository's acceptance
  // date so the 20:00–05:00 matrix and the current→72h rail share one time
  // domain. A stale 8/7 start makes a click on tonight's columns immediately
  // get reset by the forecast-timeline guard.
  const start = Date.parse(`${shanghaiDateKey()}T00:00:00Z`);
  const src = Array.from({ length: days * 24 }, (_, hourIndex) => ({
    time: new Date(start + hourIndex * 3_600_000).toISOString().slice(0, 16),
    temperature: 12 + (hourIndex % 9),
    humidity: 55 + (hourIndex % 35),
    dewPoint: 8 + (hourIndex % 7),
    precipitationProbability: hourIndex % 17,
    precipitation: 0,
    weatherCode: 0,
    cloudCover: (hourIndex * 11 + 9) % 90,
    cloudLow: (hourIndex * 7 + 13) % 100,
    cloudMid: (hourIndex * 9 + 21) % 100,
    cloudHigh: (hourIndex * 13 + 31) % 100,
    visibility: 20_000,
    windSpeed: 2,
    windGust: 4,
  }));
  return lats.map((lat, index) => ({
    locationId: `api-${Number(lat).toFixed(5)}-${Number(lons[index] ?? lat).toFixed(5)}`,
    modelLatitude: Number(lat),
    modelLongitude: Number(lons[index] ?? lat),
    modelElevation: fixture.surface.modelElevation + index * 7,
    timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28800,
    fetchedAt: "2026-08-09T08:00:00.000Z",
    metadata: {
      source: "Open-Meteo",
      model,
      fetchedAt: "2026-08-09T08:00:00.000Z",
      stale: false,
      units: { cloudCover: "%", precipitation: "mm", windSpeed: "m/s", windDirection: "°" },
    },
    hourly: src.map((hour) => ({
      ...hour,
      cloudCover: perturb("cloudCover", hour.cloudCover, index * 3),
      cloudLow: perturb("cloudLow", hour.cloudLow, index * 3),
      cloudMid: perturb("cloudMid", hour.cloudMid, index * 3),
      cloudHigh: perturb("cloudHigh", hour.cloudHigh, index * 3),
    })),
  }));
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
      // Eight days still covers the fixed 8/12 observation night while keeping
      // the multi-location browser fixture small enough for constrained CI.
      const bodies = buildSurfaceRaw(fixture, lats, lons, Math.min(days, 8));
      const payload = bodies.length > 1 ? bodies : bodies[0];
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload) });
    }
  });
}

export async function installGeocodingMock(page) {
  await page.route("**/geocoding-api.open-meteo.com/v1/search**", async (route) => {
    const url = new URL(route.request().url());
    const results = url.searchParams.get("name")?.includes("杭州")
      ? [{
          id: 1808926,
          name: "杭州",
          latitude: 30.29365,
          longitude: 120.16142,
          elevation: 12,
          admin1: "浙江",
          admin2: "杭州市",
          country: "中国",
          timezone: "Asia/Shanghai",
        }]
      : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results }) });
  });
}

/** Same-origin App Router contracts used by the integrated Next.js pages. */
export async function installNextApiMock(page, fixture) {
  await page.route("**/api/observing/snapshot**", async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("date") || "2026-08-09";
    const days = [1, 3, 5, 7].includes(Number(url.searchParams.get("days"))) ? Number(url.searchParams.get("days")) : 1;
    const model = url.searchParams.get("model") || "icon";
    const sites = {};
    for (let index = 0; index < 242; index += 1) {
      sites[`finder-${String(index + 1).padStart(3, "0")}-location`] = Array.from({ length: days }, (_, night) => ({
        score: Math.max(0, 92 - ((index + night * 9) % 44)),
        band: index % 5 === 0 ? "priority" : index % 3 === 0 ? "recommended" : "watch",
        cloud: (index * 7 + night * 11) % 100,
        darkness: index % 4 === 0 ? 100 : 78,
        weatherRisk: 82,
        bestWindow: "21:00–00:00（3h）",
        blockers: [],
        confidence: "high",
        validHours: 10,
      }));
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ date, days, model, generatedAt: "2026-08-09T08:00:00.000Z", source: "E2E snapshot", stale: false, sites }) });
  });
  await page.route("**/api/satellite/times**", async (route) => {
    const url = new URL(route.request().url());
    const kind = url.searchParams.get("kind") === "night-lights" ? "night-lights" : "cloud";
    const frames = kind === "cloud"
      ? ["2026-08-09T08:20:00Z", "2026-08-09T08:10:00Z", "2026-08-09T08:00:00Z"].map((time) => ({
          time,
          kind,
          observedAt: time,
          layer: "Himawari_AHI_Band13_Clean_Infrared",
          label: "卫星云观测",
          satellite: "Himawari AHI Band 13",
          source: "NASA GIBS",
          tileTemplate: "https://gibs.test/{Time}/{TileMatrix}/{TileRow}/{TileCol}.png",
          coverage: "测试覆盖范围",
          observed: true,
          isForecast: false,
          reference: false,
        }))
      : [{
          time: "2026-01-01",
          kind,
          observedAt: "2026-01-01",
          layer: "VIIRS_Black_Marble",
          label: "卫星夜光/辐亮度影像（2016 基准）",
          satellite: "VIIRS Black Marble",
          source: "NASA GIBS",
          tileTemplate: "https://gibs.test/{Time}/{TileMatrix}/{TileRow}/{TileCol}.png",
          coverage: "测试覆盖范围",
          observed: true,
          isForecast: false,
          reference: true,
        }];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({
        kind,
        status: "available",
        updatedAt: "2026-08-09T08:00:00.000Z",
        frames,
      }),
    });
  });
  await page.route("**/api/forecast?**", async (route) => {
    const url = new URL(route.request().url());
    const lats = (url.searchParams.get("latitude") || "").split(",").filter(Boolean);
    const lons = (url.searchParams.get("longitude") || "").split(",").filter(Boolean);
    const days = Math.min(16, Math.max(1, Number(url.searchParams.get("days")) || 14));
    const model = url.searchParams.get("model") || "icon";
    const locations = buildNormalizedForecasts(fixture, lats, lons, days, model);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ locations }),
    });
  });

  await page.route("**/api/geocode?**", async (route) => {
    const url = new URL(route.request().url());
    const results = url.searchParams.get("q")?.includes("杭州")
      ? [{
          id: 1808926,
          name: "杭州",
          latitude: 30.29365,
          longitude: 120.16142,
          elevation: 12,
          admin1: "浙江",
          country: "中国",
          timezone: "Asia/Shanghai",
        }]
      : [];
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results }),
    });
  });
}
