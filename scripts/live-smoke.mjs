#!/usr/bin/env node

/**
 * Direct upstream smoke test used before deployment and in CI.
 *
 * Required official providers fail the process. The default third-party light
 * pollution tile is reported separately because production may intentionally
 * replace it with a self-hosted/licensed template.
 */

const ENDPOINTS = {
  forecast:
    process.env.OPEN_METEO_FORECAST_URL ||
    "https://api.open-meteo.com/v1/forecast",
  geocode:
    process.env.OPEN_METEO_GEOCODE_URL ||
    "https://geocoding-api.open-meteo.com/v1/search",
  air:
    process.env.OPEN_METEO_AIR_QUALITY_URL ||
    "https://air-quality-api.open-meteo.com/v1/air-quality",
  gibs:
    process.env.GIBS_CAPABILITIES_URL ||
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml",
  kp:
    process.env.NOAA_KP_URL ||
    "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
  lightPollution:
    process.env.LIGHT_POLLUTION_PROBE_URL ||
    "https://lpm.darkmap.cn/gwc/service/wmts?layer=PostGIS:VIIR_2023&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:4&TileCol=12&TileRow=6",
};

const CLOUD_VARIABLES = [
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "precipitation",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
].join(",");

const MODELS = {
  best_match: null,
  icon: "icon_seamless",
  gfs: "gfs_seamless",
  aifs: "ecmwf_aifs025_single",
};

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json,application/xml,text/xml,image/*,*/*;q=0.8",
          "User-Agent": "star-weather-planner-live-smoke/0.3.1",
          ...(options.headers ?? {}),
        },
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `HTTP ${response.status}${detail ? ` · ${detail.slice(0, 180)}` : ""}`,
        );
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, 500 * 2 ** (attempt - 1)),
        );
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("request failed");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function numericCount(values) {
  return Array.isArray(values)
    ? values.filter(
        (value) => typeof value === "number" && Number.isFinite(value),
      ).length
    : 0;
}

async function probeForecastModel(name, providerModel) {
  const url = new URL(ENDPOINTS.forecast);
  url.searchParams.set("latitude", "30.2741");
  url.searchParams.set("longitude", "120.1551");
  url.searchParams.set("hourly", CLOUD_VARIABLES);
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("wind_speed_unit", "ms");
  if (providerModel) url.searchParams.set("models", providerModel);
  const startedAt = Date.now();
  const response = await fetchWithRetry(url);
  const data = await response.json();
  assert(Array.isArray(data.hourly?.time), `${name}: hourly.time missing`);
  for (const field of [
    "cloud_cover",
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
  ]) {
    assert(
      numericCount(data.hourly?.[field]) > 0,
      `${name}: ${field} has no numeric values`,
    );
  }
  return {
    source: `Open-Meteo ${name}`,
    status: "ok",
    hours: data.hourly.time.length,
    latencyMs: Date.now() - startedAt,
  };
}

async function probePressure() {
  const levels = [1000, 925, 850, 700, 500];
  const variables = levels.flatMap((level) => [
    `cloud_cover_${level}hPa`,
    `relative_humidity_${level}hPa`,
    `temperature_${level}hPa`,
    `geopotential_height_${level}hPa`,
  ]);
  const url = new URL(ENDPOINTS.forecast);
  url.searchParams.set("latitude", "30.2741");
  url.searchParams.set("longitude", "120.1551");
  url.searchParams.set("hourly", variables.join(","));
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("forecast_days", "1");
  const startedAt = Date.now();
  const data = await (await fetchWithRetry(url)).json();
  const available = levels.filter(
    (level) => numericCount(data.hourly?.[`cloud_cover_${level}hPa`]) > 0,
  );
  assert(available.length >= 4, "pressure: fewer than four cloud levels");
  return {
    source: "Open-Meteo pressure cloud profile",
    status: "ok",
    levels: available.length,
    latencyMs: Date.now() - startedAt,
  };
}

async function probeGeocode() {
  const url = new URL(ENDPOINTS.geocode);
  url.searchParams.set("name", "杭州");
  url.searchParams.set("count", "3");
  url.searchParams.set("language", "zh");
  url.searchParams.set("format", "json");
  const startedAt = Date.now();
  const data = await (await fetchWithRetry(url)).json();
  assert(
    Array.isArray(data.results) &&
      data.results.some(
        (item) =>
          Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
      ),
    "geocode: no valid coordinate result",
  );
  return {
    source: "Open-Meteo geocoding",
    status: "ok",
    results: data.results.length,
    latencyMs: Date.now() - startedAt,
  };
}

async function probeAirQuality() {
  const url = new URL(ENDPOINTS.air);
  url.searchParams.set("latitude", "30.2741");
  url.searchParams.set("longitude", "120.1551");
  url.searchParams.set("hourly", "us_aqi,pm2_5,pm10");
  url.searchParams.set("timezone", "Asia/Shanghai");
  url.searchParams.set("forecast_days", "1");
  const startedAt = Date.now();
  const data = await (await fetchWithRetry(url)).json();
  assert(numericCount(data.hourly?.us_aqi) > 0, "air quality: AQI missing");
  return {
    source: "Open-Meteo air quality",
    status: "ok",
    hours: data.hourly.time.length,
    latencyMs: Date.now() - startedAt,
  };
}

async function probeGibs() {
  const startedAt = Date.now();
  const xml = await (await fetchWithRetry(ENDPOINTS.gibs)).text();
  for (const identifier of [
    "Himawari_AHI_Band13_Clean_Infrared",
    "VIIRS_Black_Marble",
  ]) {
    assert(xml.includes(identifier), `GIBS: missing ${identifier}`);
  }
  assert(xml.includes("ResourceURL"), "GIBS: tile templates missing");
  return {
    source: "NASA GIBS capabilities",
    status: "ok",
    bytes: Buffer.byteLength(xml),
    latencyMs: Date.now() - startedAt,
  };
}

async function probeKp() {
  const startedAt = Date.now();
  const data = await (await fetchWithRetry(ENDPOINTS.kp)).json();
  assert(Array.isArray(data) && data.length > 1, "NOAA Kp: empty payload");
  const rows = Array.isArray(data[0]) ? data.slice(1) : data;
  assert(
    rows.some((row) => {
      const value = Array.isArray(row) ? row[1] : row.kp;
      return Number.isFinite(Number(value));
    }),
    "NOAA Kp: no numeric frame",
  );
  return {
    source: "NOAA SWPC Kp",
    status: "ok",
    frames: rows.length,
    latencyMs: Date.now() - startedAt,
  };
}

async function probeLightPollution() {
  const startedAt = Date.now();
  try {
    const response = await fetchWithRetry(ENDPOINTS.lightPollution, {}, 2);
    const contentType = response.headers.get("content-type") ?? "";
    const body = await response.arrayBuffer();
    assert(contentType.startsWith("image/"), "tile content-type is not image/*");
    assert(body.byteLength >= 64, "tile body is unexpectedly small");
    return {
      source: "VIIRS 2023 visual light-pollution tile",
      status: "ok",
      bytes: body.byteLength,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      source: "VIIRS 2023 visual light-pollution tile",
      status: "degraded",
      optional: true,
      detail: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    };
  }
}

const requiredTasks = [
  ...Object.entries(MODELS).map(([name, model]) =>
    probeForecastModel(name, model),
  ),
  probePressure(),
  probeGeocode(),
  probeAirQuality(),
  probeGibs(),
  probeKp(),
];

const required = await Promise.all(requiredTasks);
const optional = await probeLightPollution();
const report = {
  status: "ok",
  checkedAt: new Date().toISOString(),
  required,
  optional: [optional],
};
console.log(JSON.stringify(report, null, 2));
