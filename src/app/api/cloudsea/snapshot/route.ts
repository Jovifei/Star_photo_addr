import { NextRequest, NextResponse } from "next/server";
import { getShanghaiDate } from "@/data/observingSites/catalog";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import {
  buildCloudSeaSnapshot,
  type CloudSeaSnapshot,
  type RawSiteHourly,
} from "@/lib/cloudsea";
import {
  applyOpenMeteoApiKey,
  openMeteoModelParameter,
  OPEN_METEO_FORECAST_URL,
} from "@/lib/forecast";
import {
  fetchPressureForecastBatch,
  type PressureForecastBatchResult,
  type PressureForecastLocation,
} from "@/lib/pressure";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_MODELS = new Set<ForecastModel>([
  "best_match",
  "icon",
  "gfs",
  "aifs",
]);
const TTL_MS = 30 * 60_000;
const STALE_TTL_MS = 6 * 60 * 60_000;
const TIMEOUT_MS = 40_000;
const FORCE_REFRESH_COOLDOWN_MS = 60_000;
const CACHE_MAX_ENTRIES = 32;
const FORCE_TRACK_MAX_ENTRIES = 128;
const PRESSURE_BATCH_SIZE = 18;
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
  return Math.max(0, Date.now() - entry.at);
}

function usableStaleCache(key: string): CachedSnapshot | null {
  const entry = cache.get(key);
  return entry && cacheAgeMs(entry) <= STALE_TTL_MS ? entry : null;
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

function validAlignedSeries(value: unknown, expectedLength: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === expectedLength &&
    value.every(
      (item) =>
        item === null || (typeof item === "number" && Number.isFinite(item)),
    ) &&
    value.some((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function validCloudSeaHourly(hourly: Record<string, unknown>): boolean {
  const times = hourly.time;
  if (
    !Array.isArray(times) ||
    times.length === 0 ||
    !times.every((time) => typeof time === "string")
  ) {
    return false;
  }
  // Keep this list exactly aligned with the fields that affect the current
  // CloudSea condition index. temperature_2m/visibility/total-cloud are not
  // score inputs anymore and therefore must not make an otherwise usable site fail.
  const required = [
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
  ];
  return required.every((field) =>
    validAlignedSeries(hourly[field], times.length),
  );
}

async function fetchCloudSeaWeather(
  date: string,
  model: ForecastModel,
  signal: AbortSignal,
): Promise<Record<string, RawSiteHourly>> {
  const lats = CLOUD_SEA_SITES.map((site) => site.latitude).join(",");
  const lngs = CLOUD_SEA_SITES.map((site) => site.longitude).join(",");
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    hourly: [
      "relative_humidity_2m",
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "precipitation",
      "wind_speed_10m",
    ].join(","),
    timezone: "Asia/Shanghai",
    start_date: date,
    end_date: date,
  });

  const providerModel = openMeteoModelParameter(model);
  if (providerModel) params.set("models", providerModel);
  applyOpenMeteoApiKey(params);
  const url = `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }

      const rawData: unknown = await response.json();
      const list = Array.isArray(rawData) ? rawData : [rawData];
      if (list.length !== CLOUD_SEA_SITES.length) {
        throw new Error(
          `Open-Meteo surface 返回 ${list.length} 个地点，与请求的 ${CLOUD_SEA_SITES.length} 个地点不匹配`,
        );
      }

      const result: Record<string, RawSiteHourly> = {};
      CLOUD_SEA_SITES.forEach((site, index) => {
        const entry = list[index] as
          | { hourly?: Record<string, unknown> }
          | undefined;
        if (entry?.hourly && validCloudSeaHourly(entry.hourly)) {
          const hourly = entry.hourly as Record<
            string,
            Array<number | null> | string[]
          >;
          result[site.id] = {
            time: hourly.time as string[],
            cloud_cover_low: hourly.cloud_cover_low as Array<number | null>,
            cloud_cover_mid: hourly.cloud_cover_mid as Array<number | null>,
            cloud_cover_high: hourly.cloud_cover_high as Array<number | null>,
            relative_humidity_2m: hourly.relative_humidity_2m as Array<
              number | null
            >,
            precipitation: hourly.precipitation as Array<number | null>,
            wind_speed_10m: hourly.wind_speed_10m as Array<number | null>,
          };
        }
      });

      if (Object.keys(result).length > 0) return result;
      lastError = new Error("Open-Meteo surface 未返回可用云海气象数据");
    } catch (error) {
      lastError = error;
      if (signal.aborted) throw error;
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Open-Meteo 云海气象数据不可用：${date}`);
}

async function fetchCloudSeaPressure(
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
        );
        Object.assign(data, result.data);
        Object.assign(errors, result.errors);
      } catch (error) {
        // Surface has already succeeded. Pressure timeout/abort is allowed to
        // degrade vertical evidence, but must not turn real surface data into 502.
        const message =
          error instanceof Error ? error.message : "压力层剖面请求失败";
        batch.forEach((location) => {
          errors[location.id] = message;
        });
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(PRESSURE_WORKERS, batches.length) }, () =>
      worker(),
    ),
  );
  return { data, errors };
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
  const model = (params.get("model") ?? "icon") as ForecastModel;
  const forceRefresh = params.get("refresh") === "1";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date 必须是 YYYY-MM-DD 格式" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!VALID_MODELS.has(model)) {
    return NextResponse.json(
      { error: "model 必须是 best_match、icon、gfs 或 aifs" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = `${date}|${model}`;
  if (forceRefresh) {
    const last = lastForceAt.get(key) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < FORCE_REFRESH_COOLDOWN_MS) {
      const cached = usableStaleCache(key);
      if (cached) {
        return NextResponse.json(
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
      return NextResponse.json(
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
  if (cached && cacheAgeMs(cached) < TTL_MS && !forceRefresh) {
    return NextResponse.json(cached.snapshot, {
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
        // Surface is mandatory. Only request the larger pressure payload after
        // surface succeeds, so a surface outage cannot multiply upstream traffic.
        const siteWeather = await fetchCloudSeaWeather(
          date,
          model,
          controller.signal,
        );
        const pressure = await fetchCloudSeaPressure(
          date,
          model,
          controller.signal,
        );
        return buildCloudSeaSnapshot(
          date,
          model,
          { [date]: siteWeather },
          pressure.data,
          pressure.errors,
        );
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
    rememberSnapshot(key, snapshot);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Cloudsea-Cache": forceRefresh ? "forced-fresh" : "fresh",
      },
    });
  } catch (error) {
    const fallback = usableStaleCache(key);
    const message =
      error instanceof Error ? error.message : "获取云海气象数据失败";
    if (fallback) {
      return NextResponse.json(withCacheFreshness(fallback, message), {
        headers: {
          "Cache-Control": "no-store",
          "X-Cloudsea-Cache": "stale-on-error",
        },
      });
    }
    const timedOut = isTimeoutError(error);
    return NextResponse.json(
      { error: timedOut ? "云海 surface 数据请求超时" : message },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
