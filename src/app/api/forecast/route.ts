import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { clampForecastDays, fetchForecastByCoords } from "@/lib/forecast";
import { OpenMeteoRateLimitError } from "@/lib/openMeteoRateLimit";
import { MAX_FORECAST_AGE_MS, usableDiskForecast } from "@/lib/forecastIntegrity";
import { TimedCache } from "@/lib/serverCache";
import { parseCoordinateLists } from "@/lib/server/queryParams";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";
import type { ForecastModel, ForecastResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
const SNAPSHOT_DIR = process.env.OBSERVING_SNAPSHOT_DIR || os.tmpdir();
const DISK_CACHE_DIR = path.join(SNAPSHOT_DIR, "forecast-cache");

function diskCachePath(key: string): string {
  return path.join(DISK_CACHE_DIR, `${Buffer.from(key).toString("base64url")}.json`);
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

function readFromDiskCache(key: string, model: ForecastModel, count: number): ForecastResponse | null {
  if (process.env.NODE_ENV === "test" && process.env.FORECAST_ENABLE_DISK_CACHE !== "1") return null;
  try {
    const data: unknown = JSON.parse(fs.readFileSync(diskCachePath(key), "utf-8"));
    // Check ORIGINAL fetch time of every location; filesystem mtime is not provenance.
    return usableDiskForecast(data, model, count, STALE_TTL_MS) ? data : null;
  } catch {
    return null;
  }
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
  if (error instanceof OpenMeteoRateLimitError) return error.message;
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
  const key = `${model}|${days}|${normalizedCoordinateKey(latitudes)}|${normalizedCoordinateKey(longitudes)}`;
  const cached = forecastCache.read(key);
  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, { headers: responseHeaders(false, model, days, "memory", false) });
  }
  const decision = coordinator.decide(key, forceRefresh);
  if (decision.suppressed && cached && cached.ageMs <= STALE_TTL_MS) {
    const stale = cached.ageMs > FRESH_TTL_MS;
    return NextResponse.json(stale ? markStale(cached.value) : cached.value, {
      headers: responseHeaders(true, model, days, "refresh-cooldown", stale, true, decision.retryAfterSeconds),
    });
  }
  if (decision.suppressed && !coordinator.hasInFlight(key) && (!cached || cached.ageMs > STALE_TTL_MS)) {
    return jsonError("天气强制刷新处于冷却保护，请稍后重试", 429, {
      "X-Forecast-Cache": "refresh-cooldown", "X-Forecast-Model": model,
      "X-Forecast-Days": String(days), "X-Refresh-Suppressed": "true",
      ...(decision.retryAfterSeconds ? { "Retry-After": String(decision.retryAfterSeconds) } : {}),
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
    const providerLimited = error instanceof OpenMeteoRateLimitError;
    const retryAfterSeconds = Math.max(decision.retryAfterSeconds ?? 0,
      providerLimited ? Math.ceil(error.retryAfterMs / 1000) : 0) || null;
    const fallback = forecastCache.read(key);
    if (fallback && fallback.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(markStale(fallback.value), {
        headers: { ...responseHeaders(true, model, days, "stale-memory", true, decision.suppressed, retryAfterSeconds), Warning: '110 - "Response is stale"' },
      });
    }
    const diskFallback = readFromDiskCache(key, model, latitudes.length);
    if (diskFallback) {
      return NextResponse.json(markStale(diskFallback), {
        headers: { ...responseHeaders(true, model, days, "stale-disk", true, decision.suppressed, retryAfterSeconds), Warning: '110 - "Response is stale from disk"' },
      });
    }
    const timedOut = error instanceof Error && (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
    console.warn(`[api/forecast] ${timedOut ? "timeout" : "upstream failure"}`, error instanceof Error ? error.message : error);
    return jsonError(safeForecastError(error, timedOut), providerLimited ? 429 : timedOut ? 504 : 502,
      retryAfterSeconds ? { "Retry-After": String(retryAfterSeconds) } : {});
  }
}
