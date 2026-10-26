import { snapshotSourceAgeMs, snapshotTransport } from "@/lib/snapshotProvenance";
import { PROVIDER_VALIDATION_VERSION } from "@/lib/providerWeatherIntegrity";
import { NextRequest, NextResponse } from "next/server";
import { getShanghaiDate } from "@/data/observingSites/catalog";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import {
  buildCloudSeaSnapshot,
  CLOUD_SEA_SCORE_VERSION,
  hasCompleteCloudSeaCoverage,
  hasValidCloudSeaCoverageCounts,
  type CloudSeaSnapshot,
} from "@/lib/cloudsea";
import {
  currentOpenMeteoRateLimit,
  openMeteoRateLimitHeaders,
  OpenMeteoRateLimitError,
} from "@/lib/forecast";
import {
  fetchPressureForecastBatch,
  type PressureForecastBatchResult,
  type PressureForecastLocation,
} from "@/lib/pressure";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";
function snapshotJson(value: unknown, init?: ResponseInit) {
  if (value && typeof value === "object" && "sites" in value && "generatedAt" in value) {
    const snapshot = value as { generatedAt: string; stale?: boolean; provenance?: import("@/lib/snapshotProvenance").SnapshotProvenance };
    return NextResponse.json(snapshotTransport({ ...snapshot, stale: Boolean(snapshot.stale) || !Number.isFinite(snapshotSourceAgeMs(snapshot.provenance)) }), init);
  }
  return NextResponse.json(value, init);
}


const VALID_MODELS = new Set<ForecastModel>([
  "best_match",
  "icon",
  "gfs",
  "aifs",
]);
const TTL_MS = 30 * 60_000;
const STALE_TTL_MS = 6 * 60 * 60_000;
const TIMEOUT_MS = 60_000;
const FORCE_REFRESH_COOLDOWN_MS = 60_000;
const CACHE_MAX_ENTRIES = 32;
const FORCE_TRACK_MAX_ENTRIES = 128;
const PRESSURE_BATCH_SIZE = 18;
// The client serializes dates. Keep a small amount of concurrency within one
// date so the third pressure batch finishes before the route-wide timeout,
// without restoring the previous multi-date fan-out that triggered throttling.
const PRESSURE_WORKERS = 2;

interface CachedSnapshot {
  snapshot: CloudSeaSnapshot;
  at: number;
}

const cache = new Map<string, CachedSnapshot>();
const inFlight = new Map<string, Promise<CloudSeaSnapshot>>();
const lastForceAt = new Map<string, number>();

function rememberSnapshot(key: string, snapshot: CloudSeaSnapshot) {
  // Refresh insertion order so the cap behaves as an LRU-like bound instead of
  // evicting a recently refreshed key merely because it was first inserted long ago.
  cache.delete(key);
  cache.set(key, { snapshot, at: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function rememberForceRefresh(key: string, at: number) {
  lastForceAt.delete(key);
  lastForceAt.set(key, at);
  while (lastForceAt.size > FORCE_TRACK_MAX_ENTRIES) {
    const oldest = lastForceAt.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    lastForceAt.delete(oldest);
  }
}

function cacheAgeMs(entry: CachedSnapshot): number {
  return Math.max(0, Date.now() - entry.at, snapshotSourceAgeMs(entry.snapshot.provenance));
}

function isCacheableSnapshot(snapshot: CloudSeaSnapshot): boolean {
  return (
    snapshot.scoreVersion === CLOUD_SEA_SCORE_VERSION &&
    snapshot.providerValidationVersion === PROVIDER_VALIDATION_VERSION &&
    hasCompleteCloudSeaCoverage(snapshot.surface, CLOUD_SEA_SITES.length) &&
    hasCompleteCloudSeaCoverage(snapshot.pressure, CLOUD_SEA_SITES.length)
  );
}

function degradationMessage(snapshot: CloudSeaSnapshot): string {
  const issues: string[] = [];
  const surface = snapshot.surface;
  if (!hasCompleteCloudSeaCoverage(surface, CLOUD_SEA_SITES.length)) {
    issues.push(
      hasValidCloudSeaCoverageCounts(surface, CLOUD_SEA_SITES.length)
        ? `地面天气仅 ${surface!.availableSites}/${surface!.totalSites} 地点窗口完整`
        : `地面天气覆盖摘要不完整（期望 ${CLOUD_SEA_SITES.length} 地点）`,
    );
  }
  const pressure = snapshot.pressure;
  if (!hasCompleteCloudSeaCoverage(pressure, CLOUD_SEA_SITES.length)) {
    issues.push(
      hasValidCloudSeaCoverageCounts(pressure, CLOUD_SEA_SITES.length)
        ? `压力层仅 ${pressure!.availableSites}/${pressure!.totalSites} 地点可用`
        : `压力层覆盖摘要不完整（期望 ${CLOUD_SEA_SITES.length} 地点）`,
    );
  }
  return issues.length ? issues.join("；") : "云海数据不完整";
}

function usableStaleCache(key: string): CachedSnapshot | null {
  const entry = cache.get(key);
  return entry && isCacheableSnapshot(entry.snapshot) && cacheAgeMs(entry) <= STALE_TTL_MS
    ? entry
    : null;
}

function withCacheFreshness(
  entry: CachedSnapshot,
  refreshError: string,
): CloudSeaSnapshot {
  const stale = cacheAgeMs(entry) > TTL_MS || Boolean(entry.snapshot.stale);
  return {
    ...entry.snapshot,
    stale,
    refreshError,
  };
}

async function fetchCloudSeaInputs(
  date: string,
  model: ForecastModel,
  signal: AbortSignal,
): Promise<PressureForecastBatchResult> {
  const locations: PressureForecastLocation[] = CLOUD_SEA_SITES.map(
    (site) => ({
      id: site.id,
      latitude: site.latitude,
      longitude: site.longitude,
    }),
  );
  const batches: PressureForecastLocation[][] = [];
  for (let index = 0; index < locations.length; index += PRESSURE_BATCH_SIZE) {
    batches.push(locations.slice(index, index + PRESSURE_BATCH_SIZE));
  }

  const data: PressureForecastBatchResult["data"] = {};
  const errors: PressureForecastBatchResult["errors"] = {};
  const surface: NonNullable<PressureForecastBatchResult["surface"]> = {};
  let firstError: unknown;
  let cursor = 0;
  const worker = async () => {
    while (cursor < batches.length) {
      const index = cursor;
      cursor += 1;
      const batch = batches[index];
      if (!batch) continue;
      try {
        const result = await fetchPressureForecastBatch(
          batch,
          date,
          signal,
          model,
          true,
        );
        Object.assign(surface, result.surface);
        Object.assign(data, result.data);
        Object.assign(errors, result.errors);
      } catch (error) {
        // Keep trustworthy peers from other combined batches; malformed
        // pressure in a successful response can still retain its surface facts.
        if (!firstError || (firstError instanceof OpenMeteoRateLimitError && !(error instanceof OpenMeteoRateLimitError))) {
          firstError = error;
        }
        const message =
          error instanceof Error ? error.message : "压力层剖面请求失败";
        batch.forEach((location) => {
          errors[location.id] = message;
        });
        if (error instanceof OpenMeteoRateLimitError || currentOpenMeteoRateLimit()) return;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PRESSURE_WORKERS, batches.length) }, () =>
      worker(),
    ),
  );
  if (Object.keys(surface).length === 0) {
    throw firstError instanceof Error ? firstError : new Error(Object.values(errors)[0] ?? "云海来源没有可用的地面天气");
  }
  return { data, errors, surface };
}

function isTimeoutError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message))
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? getShanghaiDate();
  const model = (params.get("model") ?? "gfs") as ForecastModel;
  const forceRefresh = params.get("refresh") === "1";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return snapshotJson(
      { error: "date 必须是 YYYY-MM-DD 格式" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!VALID_MODELS.has(model)) {
    return snapshotJson(
      { error: "model 必须是 best_match、icon、gfs 或 aifs" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = `${date}|${model}`;
  if (params.get("cache_only") === "1") {
    const retained = usableStaleCache(key)?.snapshot;
    if (!retained) return snapshotJson({ error: "cache-only-miss" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60", "X-Cloudsea-Cache": "cache-only-miss" } });
    return snapshotJson({ ...retained, stale: Boolean(retained.stale) || snapshotSourceAgeMs(retained.provenance) > TTL_MS }, { headers: { "Cache-Control": "no-store", "X-Cloudsea-Cache": "cache-only" } });
  }
  if (forceRefresh) {
    const last = lastForceAt.get(key) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < FORCE_REFRESH_COOLDOWN_MS) {
      const cached = usableStaleCache(key);
      if (cached) {
        return snapshotJson(
          withCacheFreshness(cached, "强制刷新冷却中"),
          {
            headers: {
              "Cache-Control": "no-store",
              "X-Cloudsea-Cache": "refresh-cooldown",
              "Retry-After": String(
                Math.ceil((FORCE_REFRESH_COOLDOWN_MS - elapsed) / 1000),
              ),
            },
          },
        );
      }
      return snapshotJson(
        { error: "云海强制刷新处于冷却保护，请稍后重试" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-Cloudsea-Cache": "refresh-cooldown",
            "Retry-After": String(
              Math.ceil((FORCE_REFRESH_COOLDOWN_MS - elapsed) / 1000),
            ),
          },
        },
      );
    }
    rememberForceRefresh(key, Date.now());
  }

  const cached = cache.get(key);
  if (
    cached &&
    isCacheableSnapshot(cached.snapshot) &&
    cacheAgeMs(cached) < TTL_MS &&
    !forceRefresh
  ) {
    return snapshotJson(cached.snapshot, {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Cloudsea-Cache": "memory",
      },
    });
  }

  let activeTask = inFlight.get(key) ?? null;
  if (!activeTask) {
    activeTask = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const inputs = await fetchCloudSeaInputs(date, model, controller.signal);
        const snapshot = buildCloudSeaSnapshot(
          date,
          model,
          { [date]: inputs.surface ?? {} },
          inputs.data,
          inputs.errors,
        );
        return { ...snapshot, providerValidationVersion: PROVIDER_VALIDATION_VERSION };
      } finally {
        clearTimeout(timeout);
      }
    })();
    inFlight.set(key, activeTask);
    const trackedTask = activeTask;
    trackedTask
      .finally(() => {
        if (inFlight.get(key) === trackedTask) inFlight.delete(key);
      })
      .catch(() => undefined);
  }

  try {
    const snapshot = await activeTask;
    // Partial surface or pressure coverage remains useful only as an explicit
    // degraded result and must not block a retry for the normal TTL.
    const cacheable = isCacheableSnapshot(snapshot);
    if (cacheable) rememberSnapshot(key, snapshot);
    if (!cacheable) {
      const reason = degradationMessage(snapshot);
      const fallback = usableStaleCache(key);
      if (fallback) {
        return snapshotJson(
          withCacheFreshness(fallback, `本次${reason}，正在使用较早的成功快照`),
          {
            headers: {
              "Cache-Control": "no-store",
              ...openMeteoRateLimitHeaders(),
              "X-Cloudsea-Cache": "degraded-fallback",
            },
          },
        );
      }
    }
    return snapshotJson(
      cacheable ? snapshot : { ...snapshot, refreshError: degradationMessage(snapshot) },
      {
        headers: {
          "Cache-Control": cacheable
            ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600"
            : "no-store",
          ...openMeteoRateLimitHeaders(),
          "X-Cloudsea-Cache": cacheable
            ? forceRefresh
              ? "forced-fresh"
              : "fresh"
            : "degraded",
        },
      },
    );
  } catch (error) {
    const fallback = usableStaleCache(key);
    const message =
      error instanceof Error ? error.message : "获取云海气象数据失败";
    if (fallback) {
      return snapshotJson(withCacheFreshness(fallback, message), {
        headers: {
          "Cache-Control": "no-store",
          ...openMeteoRateLimitHeaders(),
          "X-Cloudsea-Cache": "stale-on-error",
        },
      });
    }
    const timedOut = isTimeoutError(error);
    return snapshotJson(
      { error: timedOut ? "云海 surface 数据请求超时" : message },
      {
        status: error instanceof OpenMeteoRateLimitError ? 429 : timedOut ? 504 : 502,
        headers: {
          "Cache-Control": "no-store",
          ...openMeteoRateLimitHeaders(),
        },
      },
    );
  }
}
