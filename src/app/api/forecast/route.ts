import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { clampForecastDays, fetchForecastByCoords, OpenMeteoRateLimitError, openMeteoRateLimitHeaders } from "@/lib/forecast";
import { MAX_FORECAST_AGE_MS, usableDiskForecast } from "@/lib/forecastIntegrity";
import { TimedCache } from "@/lib/serverCache";
import { parseCoordinateLists } from "@/lib/server/queryParams";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";
import type { ForecastModel, ForecastResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
const SNAPSHOT_DIR = process.env.OBSERVING_SNAPSHOT_DIR || os.tmpdir();
const DISK_CACHE_DIR = path.join(SNAPSHOT_DIR, "forecast-cache");

function diskCachePath(key: string): string {
  return path.join(DISK_CACHE_DIR, `${createHash("sha256").update(key).digest("hex")}.json`);
}

function saveToDiskCache(key: string, data: ForecastResponse) {
  if (process.env.NODE_ENV === "test" && process.env.FORECAST_ENABLE_DISK_CACHE !== "1") return;
  try {
    fs.mkdirSync(DISK_CACHE_DIR, { recursive: true });
    // Readers must not see a truncated JSON during concurrent cache writes.
    const destination = diskCachePath(key);
    const temporary = `${destination}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(data), "utf-8");
    fs.renameSync(temporary, destination);
  } catch {
    // Persistence is optional; a write failure must not fabricate data.
  }
}

function readFromDiskCache(
  key: string,
  model: ForecastModel,
  count: number,
  maxAgeMs: number,
): ForecastResponse | null {
  if (process.env.NODE_ENV === "test" && process.env.FORECAST_ENABLE_DISK_CACHE !== "1") return null;
  // Retain existing short-name caches during migration; never clear stored facts.
  const legacyName = `${Buffer.from(key).toString("base64url")}.json`;
  const candidates = [diskCachePath(key)];
  if (legacyName.length <= 255) candidates.push(path.join(DISK_CACHE_DIR, legacyName));
  for (const filename of candidates) {
    try {
      const data: unknown = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ filename, "utf-8"));
      // Check ORIGINAL fetch time; filesystem mtime is not provenance.
      if (usableDiskForecast(data, model, count, maxAgeMs)) return data;
    } catch { /* Missing or invalid cache entries do not fabricate data. */ }
  }
  return null;
}

function readPreOffsetDiskCache(
  key: string,
  model: ForecastModel,
  latitudes: number[],
  longitudes: number[],
  maxAgeMs: number,
): ForecastResponse | null {
  const data = readFromDiskCache(key, model, latitudes.length, maxAgeMs);
  if (!data) return null;
  const sameRequestedPoints = data.locations.every((location, index) =>
    Number.isFinite(location.requestedLatitude) &&
    Number.isFinite(location.requestedLongitude) &&
    Math.abs(location.requestedLatitude! - latitudes[index]!) <= 1e-5 &&
    Math.abs(location.requestedLongitude! - longitudes[index]!) <= 1e-5,
  );
  return sameRequestedPoints ? data : null;
}

type RetainedDiskOrigin = "current" | "pre-offset" | "legacy";

function readRetainedDiskForecast(
  currentKey: string,
  preOffsetKey: string,
  legacyKey: string,
  model: ForecastModel,
  latitudes: number[],
  longitudes: number[],
  maxAgeMs: number,
): { data: ForecastResponse; origin: RetainedDiskOrigin } | null {
  const current = readFromDiskCache(currentKey, model, latitudes.length, maxAgeMs);
  if (current) return { data: current, origin: "current" };
  const preOffset = readPreOffsetDiskCache(
    preOffsetKey,
    model,
    latitudes,
    longitudes,
    maxAgeMs,
  );
  if (preOffset) return { data: preOffset, origin: "pre-offset" };
  const legacy = readFromDiskCache(legacyKey, model, latitudes.length, maxAgeMs);
  return legacy ? { data: legacy, origin: "legacy" } : null;
}

const MODELS = new Set<ForecastModel>(["best_match", "icon", "gfs", "aifs"]);
function boundedInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback;
}
const FRESH_TTL_MS = boundedInteger("FORECAST_CACHE_TTL_MS", 10 * 60_000, 30_000, 60 * 60_000);
// A deployment override may shorten retention, but cannot revive multi-day forecasts.
const STALE_TTL_MS = boundedInteger("FORECAST_STALE_TTL_MS", MAX_FORECAST_AGE_MS, FRESH_TTL_MS, MAX_FORECAST_AGE_MS);
const REQUEST_TIMEOUT_MS = boundedInteger("FORECAST_REQUEST_TIMEOUT_MS", 25_000, 3_000, 120_000);
const FORCE_REFRESH_COOLDOWN_MS = boundedInteger("FORECAST_FORCE_REFRESH_COOLDOWN_MS", 60_000, 5_000, 15 * 60_000);
const MAX_LOCATIONS = boundedInteger("FORECAST_MAX_LOCATIONS", 64, 1, 256);
const forecastCache = new TimedCache<ForecastResponse>(192);
const coordinator = new RefreshCoordinator<ForecastResponse>(FORCE_REFRESH_COOLDOWN_MS, 192);

function markStale(data: ForecastResponse): ForecastResponse {
  const metadata = data.metadata ? { ...data.metadata, stale: true } : undefined;
  return {
    ...data, metadata,
    locations: data.locations.map((location) => ({
      ...location, metadata: location.metadata ? { ...location.metadata, stale: true } : metadata,
    })),
  };
}
function normalizedCoordinateKey(values: number[]): string {
  return values.map((value) => Number(value.toFixed(6)).toString()).join(",");
}
function safeForecastError(error: unknown, timedOut: boolean): string {
  if (timedOut) return "天气数据请求超时";
  if (error instanceof Error) {
    if (/^天气上游/.test(error.message)) return error.message;
    const status = error.message.match(/天气接口返回 HTTP (\d{3})/)?.[1];
    if (status) return `天气上游返回 HTTP ${status}`;
  }
  return "天气上游暂时不可用";
}
function responseHeaders(forceRefresh: boolean, model: ForecastModel, days: number, cacheState: string, stale: boolean, refreshSuppressed = false, retryAfterSeconds: number | null = null): Record<string, string> {
  return {
    "Cache-Control": forceRefresh || stale ? "no-store, max-age=0" : "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
    Vary: "Accept-Encoding", "X-Forecast-Cache": cacheState, "X-Forecast-Model": model,
    "X-Forecast-Days": String(days), "X-Data-Stale": String(stale),
    "X-Refresh-Suppressed": String(refreshSuppressed),
    ...(retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {}),
  };
}
function jsonError(error: string, status: number, headers: Record<string, string> = {}) {
  return NextResponse.json({ error, stale: false }, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

/** GET /api/forecast?latitude=...&longitude=...&days=...&model=... */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const modelRaw = searchParams.get("model") ?? "best_match";
  const forceRefresh = searchParams.get("refresh") === "1";
  if (!MODELS.has(modelRaw as ForecastModel)) return jsonError("model 必须是 best_match、icon、gfs 或 aifs", 400);
  const coordinates = parseCoordinateLists(searchParams, MAX_LOCATIONS);
  if (!coordinates) return jsonError(`latitude 和 longitude 必须是非空、合法且一一对应的坐标，单次最多 ${MAX_LOCATIONS} 个地点`, 400);
  const { latitudes, longitudes } = coordinates;
  const model = modelRaw as ForecastModel;
  const daysRaw = Number(searchParams.get("days") ?? "14");
  const days = clampForecastDays(Number.isFinite(daysRaw) ? daysRaw : 14, model);
  const legacyKey = `${model}|${days}|${normalizedCoordinateKey(latitudes)}|${normalizedCoordinateKey(longitudes)}`;
  const preOffsetKey = `surface-v2-past1|${legacyKey}`;
  // v3 is the fresh offset-integrity boundary. v2 may still be exposed as
  // explicitly stale raw weather facts, but never as fresh data or score input.
  const key = `surface-v3-offset|${legacyKey}`;
  const cached = forecastCache.read(key);
  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, { headers: responseHeaders(false, model, days, "memory", false) });
  }
  if (searchParams.get("cache_only") === "1") {
    if (cached && cached.ageMs <= STALE_TTL_MS) {
      const stale = cached.ageMs > FRESH_TTL_MS;
      return NextResponse.json(stale ? markStale(cached.value) : cached.value, {
        headers: responseHeaders(true, model, days, "cache-only-memory", stale),
      });
    }
    const freshDisk = readFromDiskCache(
      key,
      model,
      latitudes.length,
      FRESH_TTL_MS,
    );
    if (freshDisk) {
      return NextResponse.json(freshDisk, {
        headers: responseHeaders(
          true,
          model,
          days,
          "cache-only-disk",
          false,
        ),
      });
    }
    const retained = readRetainedDiskForecast(
      key,
      preOffsetKey,
      legacyKey,
      model,
      latitudes,
      longitudes,
      STALE_TTL_MS,
    );
    if (retained) {
      const cacheState = retained.origin === "pre-offset"
        ? "cache-only-pre-offset-disk"
        : "cache-only-disk";
      return NextResponse.json(markStale(retained.data), {
        headers: responseHeaders(
          true,
          model,
          days,
          cacheState,
          true,
        ),
      });
    }
    return jsonError("天气上游冷却中，此地点暂无有效缓存", 429, {
      "X-Forecast-Cache": "cache-only-miss",
      ...openMeteoRateLimitHeaders(60),
    });
  }
  const decision = coordinator.decide(key, forceRefresh);
  if (decision.suppressed && cached && cached.ageMs <= STALE_TTL_MS) {
    const stale = cached.ageMs > FRESH_TTL_MS;
    return NextResponse.json(stale ? markStale(cached.value) : cached.value, {
      headers: {
        ...responseHeaders(
          true,
          model,
          days,
          "refresh-cooldown",
          stale,
          true,
          decision.retryAfterSeconds,
        ),
        ...openMeteoRateLimitHeaders(decision.retryAfterSeconds),
      },
    });
  }
  if (decision.suppressed && !coordinator.hasInFlight(key) && (!cached || cached.ageMs > STALE_TTL_MS)) {
    return jsonError("天气强制刷新处于冷却保护，请稍后重试", 429, {
      "X-Forecast-Cache": "refresh-cooldown",
      "X-Forecast-Model": model,
      "X-Forecast-Days": String(days),
      "X-Refresh-Suppressed": "true",
      ...openMeteoRateLimitHeaders(decision.retryAfterSeconds),
    });
  }
  const coordinated = coordinator.run(key, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const data = await fetchForecastByCoords(latitudes, longitudes, days, controller.signal, model);
      forecastCache.write(key, data);
      saveToDiskCache(key, data);
      return data;
    } finally { clearTimeout(timeout); }
  });
  try {
    const data = await coordinated.promise;
    return NextResponse.json(data, {
      headers: responseHeaders(forceRefresh, model, days, coordinated.coalesced ? "coalesced" : "refresh", false, decision.suppressed, decision.retryAfterSeconds),
    });
  } catch (error) {
    const fallback = forecastCache.read(key);
    if (fallback && fallback.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(markStale(fallback.value), {
        headers: { ...responseHeaders(true, model, days, "stale-memory", true, decision.suppressed, decision.retryAfterSeconds), Warning: '110 - "Response is stale"' },
      });
    }
    const diskFallback = readRetainedDiskForecast(
      key,
      preOffsetKey,
      legacyKey,
      model,
      latitudes,
      longitudes,
      STALE_TTL_MS,
    );
    if (diskFallback) {
      const cacheState = diskFallback.origin === "pre-offset"
        ? "stale-pre-offset-disk"
        : "stale-disk";
      const warning = diskFallback.origin === "pre-offset"
        ? '110 - "Response is stale pre-offset weather facts; recommendations withheld"'
        : '110 - "Response is stale from disk"';
      return NextResponse.json(markStale(diskFallback.data), {
        headers: { ...responseHeaders(true, model, days, cacheState, true, decision.suppressed, decision.retryAfterSeconds), Warning: warning },
      });
    }
    if (error instanceof OpenMeteoRateLimitError) {
      return jsonError(error.message, 429, {
        "Retry-After": String(Math.ceil(error.retryAfterMs / 1000)),
        "X-Forecast-Cache": "provider-cooldown",
        "X-Forecast-Model": model,
        "X-Weather-Limit": error.dailyLimit ? "daily" : "temporary",
      });
    }
    const timedOut = error instanceof Error && (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
    console.warn(`[api/forecast] ${timedOut ? "timeout" : "upstream failure"}`, error instanceof Error ? error.message : error);
    return jsonError(safeForecastError(error, timedOut), timedOut ? 504 : 502);
  }
}
