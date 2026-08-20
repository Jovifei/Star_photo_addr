import { NextRequest, NextResponse } from "next/server";
import { TimedCache } from "@/lib/serverCache";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";

export const dynamic = "force-dynamic";

const AIR_QUALITY_URL =
  process.env.OPEN_METEO_AIR_QUALITY_URL?.trim() ||
  "https://air-quality-api.open-meteo.com/v1/air-quality";
const FRESH_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const FORCE_REFRESH_COOLDOWN_MS = 60_000;

interface AirQualityPayload {
  metadata: {
    source: "Open-Meteo CAMS";
    model: "cams";
    fetchedAt: string;
    stale: boolean;
    units: Record<string, string>;
  };
  hourly: Array<{
    time: string;
    usAqi: number | null;
    pm2_5: number | null;
    pm10: number | null;
    ozone: number | null;
    nitrogenDioxide: number | null;
    sulphurDioxide: number | null;
  }>;
}

const cache = new TimedCache<AirQualityPayload>(128);
const coordinator = new RefreshCoordinator<AirQualityPayload>(
  FORCE_REFRESH_COOLDOWN_MS,
  128,
);

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function alignedNumericSeries(
  value: unknown,
  expectedLength: number,
): boolean {
  return (
    Array.isArray(value) &&
    value.length === expectedLength &&
    value.some(
      (item) => typeof item === "number" && Number.isFinite(item),
    )
  );
}

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
    "X-Air-Quality-Cache": cacheState,
    "X-Data-Stale": String(stale),
    "X-Refresh-Suppressed": String(refreshSuppressed),
    ...(retryAfterSeconds
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
  };
}

async function fetchAirQuality(
  latitude: number,
  longitude: number,
  days: number,
): Promise<AirQualityPayload> {
  const upstream = new URL(AIR_QUALITY_URL);
  upstream.searchParams.set("latitude", String(latitude));
  upstream.searchParams.set("longitude", String(longitude));
  upstream.searchParams.set(
    "hourly",
    "us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide",
  );
  upstream.searchParams.set("timezone", "auto");
  upstream.searchParams.set("forecast_days", String(days));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(upstream, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`空气质量接口返回 HTTP ${response.status}`);
    }
    const data = (await response.json()) as {
      hourly?: Record<string, unknown[]>;
    };
    const rawTimes = data.hourly?.time;
    if (
      !Array.isArray(rawTimes) ||
      rawTimes.length === 0 ||
      !rawTimes.every((time) => typeof time === "string")
    ) {
      throw new Error("空气质量上游返回了无法识别的 hourly 数据");
    }
    for (const field of ["us_aqi", "pm2_5", "pm10"] as const) {
      if (!alignedNumericSeries(data.hourly?.[field], rawTimes.length)) {
        throw new Error(`空气质量上游没有返回有效 ${field} 数据`);
      }
    }

    const times = rawTimes as string[];
    const fetchedAt = new Date().toISOString();
    return {
      metadata: {
        source: "Open-Meteo CAMS",
        model: "cams",
        fetchedAt,
        stale: false,
        units: {
          usAqi: "US AQI",
          pm2_5: "μg/m³",
          pm10: "μg/m³",
        },
      },
      hourly: times.map((time, index) => ({
        time,
        usAqi: numberOrNull(data.hourly?.us_aqi?.[index]),
        pm2_5: numberOrNull(data.hourly?.pm2_5?.[index]),
        pm10: numberOrNull(data.hourly?.pm10?.[index]),
        ozone: numberOrNull(data.hourly?.ozone?.[index]),
        nitrogenDioxide: numberOrNull(
          data.hourly?.nitrogen_dioxide?.[index],
        ),
        sulphurDioxide: numberOrNull(
          data.hourly?.sulphur_dioxide?.[index],
        ),
      })),
    };
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
  const daysRaw = Number(params.get("days") ?? "2");
  const days = Number.isFinite(daysRaw)
    ? Math.min(5, Math.max(1, Math.floor(daysRaw)))
    : 2;
  const key = `${latitude.toFixed(5)}|${longitude.toFixed(5)}|${days}`;
  const cached = cache.read(key);
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
    const stale = cached.ageMs > FRESH_TTL_MS;
    const payload = stale
      ? {
          ...cached.value,
          metadata: { ...cached.value.metadata, stale: true },
        }
      : cached.value;
    return NextResponse.json(payload, {
      headers: responseHeaders(
        true,
        "refresh-cooldown",
        stale,
        true,
        decision.retryAfterSeconds,
      ),
    });
  }

  const coordinated = coordinator.run(key, async () => {
    const payload = await fetchAirQuality(latitude, longitude, days);
    cache.write(key, payload);
    return payload;
  });

  try {
    const payload = await coordinated.promise;
    return NextResponse.json(payload, {
      headers: responseHeaders(
        forceRefresh,
        coordinated.coalesced ? "coalesced" : "refresh",
        false,
        decision.suppressed,
        decision.retryAfterSeconds,
      ),
    });
  } catch (error) {
    const fallback = cache.read(key);
    if (fallback && fallback.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(
        {
          ...fallback.value,
          metadata: { ...fallback.value.metadata, stale: true },
        },
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
          ? "空气质量数据请求超时"
          : "空气质量数据暂时不可用",
        stale: false,
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
