import { NextRequest, NextResponse } from "next/server";
import { clampForecastDays } from "@/lib/forecast";
import {
  fetchPressureForecast,
  type PressureForecastResponse,
} from "@/lib/pressure";
import { TimedCache } from "@/lib/serverCache";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODELS = new Set<ForecastModel>([
  "best_match",
  "icon",
  "gfs",
  "aifs",
]);
const FRESH_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 25_000;
const FORCE_REFRESH_COOLDOWN_MS = 60_000;
const pressureCache = new TimedCache<PressureForecastResponse>(128);
const coordinator = new RefreshCoordinator<PressureForecastResponse>(
  FORCE_REFRESH_COOLDOWN_MS,
  128,
);

function responseHeaders(
  forceRefresh: boolean,
  cacheState: string,
  stale: boolean,
  refreshSuppressed: boolean,
  retryAfterSeconds: number | null,
): Record<string, string> {
  return {
    "Cache-Control": forceRefresh
      ? "no-store, max-age=0"
      : "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
    "X-Pressure-Cache": cacheState,
    "X-Data-Stale": String(stale),
    "X-Refresh-Suppressed": String(refreshSuppressed),
    ...(retryAfterSeconds
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
  };
}

async function loadPressureForecast(
  latitude: number,
  longitude: number,
  days: number,
  model: ForecastModel,
): Promise<PressureForecastResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchPressureForecast(
      latitude,
      longitude,
      days,
      controller.signal,
      model,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitudeRaw = params.get("latitude") ?? params.get("lat");
  const longitudeRaw = params.get("longitude") ?? params.get("lng");
  const latitude = latitudeRaw === null ? Number.NaN : Number(latitudeRaw);
  const longitude = longitudeRaw === null ? Number.NaN : Number(longitudeRaw);
  const model = (params.get("model") ?? "best_match") as ForecastModel;
  const forceRefresh = params.get("refresh") === "1";

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json(
      { error: "必须提供合法 latitude 和 longitude" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!MODELS.has(model)) {
    return NextResponse.json(
      { error: "不支持的 forecast model" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  const daysRaw = Number(params.get("days") ?? "7");
  const days = clampForecastDays(
    Number.isFinite(daysRaw) ? daysRaw : 7,
    model,
  );
  const key = `${model}|${days}|${latitude.toFixed(5)}|${longitude.toFixed(5)}`;
  const cached = pressureCache.read(key);

  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, {
      headers: responseHeaders(false, "memory", false, false, null),
    });
  }

  const decision = coordinator.decide(key, forceRefresh);
  if (
    decision.suppressed &&
    cached &&
    cached.ageMs <= STALE_TTL_MS
  ) {
    const stale = cached.ageMs > FRESH_TTL_MS || Boolean(cached.value.stale);
    return NextResponse.json(
      stale ? { ...cached.value, stale: true } : cached.value,
      {
        headers: responseHeaders(
          true,
          "refresh-cooldown",
          stale,
          true,
          decision.retryAfterSeconds,
        ),
      },
    );
  }

  const coordinated = coordinator.run(key, async () => {
    const data = await loadPressureForecast(latitude, longitude, days, model);
    pressureCache.write(key, data);
    return data;
  });

  try {
    const data = await coordinated.promise;
    return NextResponse.json(data, {
      headers: responseHeaders(
        forceRefresh,
        coordinated.coalesced ? "coalesced" : "refresh",
        false,
        decision.suppressed,
        decision.retryAfterSeconds,
      ),
    });
  } catch (error) {
    const fallback = pressureCache.read(key);
    if (fallback && fallback.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(
        { ...fallback.value, stale: true },
        {
          headers: {
            ...responseHeaders(
              true,
              "stale-memory",
              true,
              decision.suppressed,
              decision.retryAfterSeconds,
            ),
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
    return NextResponse.json(
      {
        error: timedOut
          ? "气压数据请求超时"
          : "气压数据暂时不可用",
        stale: false,
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
