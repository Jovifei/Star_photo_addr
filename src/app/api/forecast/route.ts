import { NextRequest, NextResponse } from "next/server";
import {
  clampForecastDays,
  fetchForecastByCoords,
} from "@/lib/forecast";
import { TimedCache } from "@/lib/serverCache";
import type { ForecastModel, ForecastResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODELS = new Set<ForecastModel>([
  "best_match",
  "icon",
  "gfs",
  "aifs",
]);

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

const FRESH_TTL_MS = boundedInteger(
  "FORECAST_CACHE_TTL_MS",
  10 * 60_000,
  30_000,
  60 * 60_000,
);
const STALE_TTL_MS = boundedInteger(
  "FORECAST_STALE_TTL_MS",
  6 * 60 * 60_000,
  FRESH_TTL_MS,
  48 * 60 * 60_000,
);
const REQUEST_TIMEOUT_MS = boundedInteger(
  "FORECAST_REQUEST_TIMEOUT_MS",
  25_000,
  3_000,
  120_000,
);
const FORCE_REFRESH_COOLDOWN_MS = boundedInteger(
  "FORECAST_FORCE_REFRESH_COOLDOWN_MS",
  60_000,
  5_000,
  15 * 60_000,
);
const MAX_LOCATIONS = boundedInteger(
  "FORECAST_MAX_LOCATIONS",
  64,
  1,
  256,
);

const forecastCache = new TimedCache<ForecastResponse>(192);
const inFlight = new Map<string, Promise<ForecastResponse>>();
const lastForcedRefreshAt = new Map<string, number>();

function markStale(data: ForecastResponse): ForecastResponse {
  const metadata = data.metadata
    ? { ...data.metadata, stale: true }
    : undefined;
  return {
    ...data,
    metadata,
    locations: data.locations.map((location) => ({
      ...location,
      metadata: location.metadata
        ? { ...location.metadata, stale: true }
        : metadata,
    })),
  };
}

function cacheHeaders(forceRefresh: boolean): Record<string, string> {
  return {
    "Cache-Control": forceRefresh
      ? "no-store, max-age=0"
      : "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
    Vary: "Accept-Encoding",
  };
}

function trimRefreshHistory(): void {
  while (lastForcedRefreshAt.size > 192) {
    const oldest = lastForcedRefreshAt.keys().next().value as
      | string
      | undefined;
    if (!oldest) break;
    lastForcedRefreshAt.delete(oldest);
  }
}

function normalizedCoordinateKey(values: number[]): string {
  return values
    .map((value) => Number(value.toFixed(6)).toString())
    .join(",");
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

function responseHeaders(
  forceRefresh: boolean,
  model: ForecastModel,
  days: number,
  cacheState: string,
  stale: boolean,
  refreshSuppressed = false,
): Record<string, string> {
  return {
    ...cacheHeaders(forceRefresh),
    "X-Forecast-Cache": cacheState,
    "X-Forecast-Model": model,
    "X-Forecast-Days": String(days),
    "X-Data-Stale": String(stale),
    "X-Refresh-Suppressed": String(refreshSuppressed),
  };
}

/** GET /api/forecast?latitude=...&longitude=...&days=...&model=... */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latitudeRaw = searchParams.get("latitude") ?? searchParams.get("lat");
  const longitudeRaw =
    searchParams.get("longitude") ?? searchParams.get("lng");
  const modelRaw = searchParams.get("model") ?? "best_match";
  const forceRefresh = searchParams.get("refresh") === "1";

  if (!latitudeRaw || !longitudeRaw) {
    return NextResponse.json(
      { error: "缺少 latitude 或 longitude 参数" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!MODELS.has(modelRaw as ForecastModel)) {
    return NextResponse.json(
      { error: "model 必须是 best_match、icon、gfs 或 aifs" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const latitudes = latitudeRaw
    .split(",")
    .map((value) => Number(value.trim()));
  const longitudes = longitudeRaw
    .split(",")
    .map((value) => Number(value.trim()));
  const validCoordinates =
    latitudes.length > 0 &&
    latitudes.length === longitudes.length &&
    latitudes.length <= MAX_LOCATIONS &&
    latitudes.every(
      (value) => Number.isFinite(value) && value >= -90 && value <= 90,
    ) &&
    longitudes.every(
      (value) => Number.isFinite(value) && value >= -180 && value <= 180,
    );

  if (!validCoordinates) {
    return NextResponse.json(
      {
        error: `latitude 和 longitude 必须是合法且一一对应的坐标，单次最多 ${MAX_LOCATIONS} 个地点`,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const model = modelRaw as ForecastModel;
  const daysRaw = Number(searchParams.get("days") ?? "14");
  const days = clampForecastDays(
    Number.isFinite(daysRaw) ? daysRaw : 14,
    model,
  );
  const key = `${model}|${days}|${normalizedCoordinateKey(latitudes)}|${normalizedCoordinateKey(longitudes)}`;
  const now = Date.now();
  const cached = forecastCache.read(key, now);

  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, {
      headers: responseHeaders(
        false,
        model,
        days,
        "memory",
        false,
      ),
    });
  }

  const lastForced = lastForcedRefreshAt.get(key) ?? 0;
  if (
    forceRefresh &&
    cached &&
    cached.ageMs <= STALE_TTL_MS &&
    now - lastForced < FORCE_REFRESH_COOLDOWN_MS
  ) {
    const stale = cached.ageMs > FRESH_TTL_MS;
    return NextResponse.json(
      stale ? markStale(cached.value) : cached.value,
      {
        headers: responseHeaders(
          true,
          model,
          days,
          "refresh-cooldown",
          stale,
          true,
        ),
      },
    );
  }

  let activeTask = inFlight.get(key);
  let cacheState = "coalesced";
  if (!activeTask) {
    cacheState = "refresh";
    if (forceRefresh) {
      lastForcedRefreshAt.set(key, now);
      trimRefreshHistory();
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    activeTask = (async () => {
      try {
        const data = await fetchForecastByCoords(
          latitudes,
          longitudes,
          days,
          controller.signal,
          model,
        );
        forecastCache.write(key, data);
        return data;
      } finally {
        clearTimeout(timeout);
      }
    })();
    inFlight.set(key, activeTask);
    void activeTask
      .finally(() => {
        if (inFlight.get(key) === activeTask) inFlight.delete(key);
      })
      .catch(() => undefined);
  }

  try {
    const data = await activeTask;
    return NextResponse.json(data, {
      headers: responseHeaders(
        forceRefresh,
        model,
        days,
        cacheState,
        false,
      ),
    });
  } catch (error) {
    const fallback = forecastCache.read(key);
    if (fallback && fallback.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(markStale(fallback.value), {
        headers: {
          ...responseHeaders(
            true,
            model,
            days,
            "stale-memory",
            true,
          ),
          Warning: '110 - "Response is stale"',
        },
      });
    }
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
    console.warn(
      `[api/forecast] ${timedOut ? "timeout" : "upstream failure"}`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: safeForecastError(error, timedOut), stale: false },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
