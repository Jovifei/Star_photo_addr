#!/usr/bin/env node

/**
 * Post-deployment application smoke test.
 *
 * Unlike scripts/live-smoke.mjs (which calls providers directly), this script
 * verifies the deployed Next.js routes, cache/refresh path and response
 * contracts that browsers actually use.
 */

const baseUrl = (
  process.env.DATA_SOURCE_BASE_URL ||
  `http://127.0.0.1:${process.env.APP_PORT || "3100"}`
).replace(/\/$/, "");
const timeoutMs = Math.min(
  180_000,
  Math.max(5_000, Number(process.env.DATA_SOURCE_CHECK_TIMEOUT_MS) || 45_000),
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function requestJson(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "star-weather-planner-deployment-check/0.3.1",
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`${path}: HTTP ${response.status}`);
    }
    assert(payload && typeof payload === "object", `${path}: JSON body missing`);
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

function finiteValues(items, field) {
  return Array.isArray(items)
    ? items.filter(
        (item) => typeof item?.[field] === "number" && Number.isFinite(item[field]),
      ).length
    : 0;
}

async function checkHealth() {
  const { payload } = await requestJson("/healthz");
  assert(payload.status === "ok", "/healthz: status is not ok");
  assert(
    payload.app === "star-weather-planner",
    "/healthz: unexpected application identity",
  );
  return {
    check: "application",
    status: "ok",
    version: payload.version ?? null,
    revision: payload.buildRevision ?? null,
  };
}

async function checkForecast() {
  const { response, payload } = await requestJson(
    "/api/forecast?latitude=30.2741&longitude=120.1551&days=2&model=best_match&refresh=1",
  );
  const location = payload.locations?.[0];
  const hourly = location?.hourly;
  assert(Array.isArray(hourly) && hourly.length > 0, "/api/forecast: hourly missing");
  for (const field of ["cloudCover", "cloudLow", "cloudMid", "cloudHigh"]) {
    assert(
      finiteValues(hourly, field) > 0,
      `/api/forecast: ${field} has no finite values`,
    );
  }
  return {
    check: "forecast-clouds",
    status: "ok",
    hours: hourly.length,
    model: location.metadata?.model ?? payload.metadata?.model ?? null,
    cache: response.headers.get("x-forecast-cache"),
    stale: response.headers.get("x-data-stale"),
  };
}

async function checkDataStatus() {
  const { response, payload } = await requestJson(
    "/api/data-status?refresh=1",
  );
  const required = ["weather", "satellite", "light-pollution"];
  for (const id of required) {
    assert(payload.sources?.[id], `/api/data-status: ${id} source missing`);
  }
  assert(
    payload.sources.weather.status === "available",
    `/api/data-status: weather is ${payload.sources.weather.status}`,
  );
  assert(
    payload.sources.satellite.status === "available",
    `/api/data-status: satellite is ${payload.sources.satellite.status}`,
  );
  assert(
    payload.sources["light-pollution"].status === "available",
    `/api/data-status: light-pollution is ${payload.sources["light-pollution"].status}`,
  );
  return {
    check: "data-source-health",
    status: payload.status,
    cache: response.headers.get("x-data-source-cache"),
    refreshSuppressed: response.headers.get("x-refresh-suppressed"),
    sources: Object.fromEntries(
      Object.entries(payload.sources).map(([id, source]) => [id, source.status]),
    ),
  };
}

async function checkSatellite(kind) {
  const { response, payload } = await requestJson(
    `/api/satellite/times?kind=${kind}&refresh=1`,
  );
  assert(Array.isArray(payload.frames) && payload.frames.length > 0, `${kind}: frames missing`);
  assert(payload.frames[0]?.tileTemplate, `${kind}: tile template missing`);
  return {
    check: `satellite-${kind}`,
    status: payload.status,
    frames: payload.frames.length,
    cache: response.headers.get("x-gibs-cache"),
    stale: response.headers.get("x-data-stale"),
  };
}

const checks = [
  checkHealth,
  checkForecast,
  checkDataStatus,
  () => checkSatellite("cloud"),
  () => checkSatellite("night-lights"),
];
const results = [];

try {
  for (const check of checks) {
    results.push(await check());
  }
  console.log(
    JSON.stringify(
      {
        status: "ok",
        baseUrl,
        checkedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        status: "failed",
        baseUrl,
        checkedAt: new Date().toISOString(),
        completed: results,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
