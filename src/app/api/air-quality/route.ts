import { NextRequest, NextResponse } from "next/server";
import { TimedCache } from "@/lib/serverCache";

export const dynamic = "force-dynamic";

const AIR_QUALITY_URL =
  process.env.OPEN_METEO_AIR_QUALITY_URL?.trim() ||
  "https://air-quality-api.open-meteo.com/v1/air-quality";
const FRESH_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000;

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

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
        "X-Air-Quality-Cache": "memory",
        "X-Data-Stale": "false",
      },
    });
  }

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
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(upstream, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`空气质量接口返回 ${response.status}`);
    }
    const data = (await response.json()) as {
      hourly?: Record<string, unknown[]>;
    };
    if (!Array.isArray(data.hourly?.time)) {
      throw new Error("空气质量上游返回了无法识别的 hourly 数据");
    }
    const fetchedAt = new Date().toISOString();
    const payload: AirQualityPayload = {
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
      hourly: data.hourly.time
        .filter((time): time is string => typeof time === "string")
        .map((time, index) => ({
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
    cache.write(key, payload);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
        "X-Air-Quality-Cache": "refresh",
        "X-Data-Stale": "false",
      },
    });
  } catch (error) {
    if (cached && cached.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(
        {
          ...cached.value,
          metadata: { ...cached.value.metadata, stale: true },
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-Air-Quality-Cache": "stale-memory",
            "X-Data-Stale": "true",
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const message = controller.signal.aborted
      ? "空气质量数据请求超时"
      : error instanceof Error
        ? error.message
        : "空气质量数据请求失败";
    return NextResponse.json(
      { error: message, stale: false },
      {
        status: controller.signal.aborted ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
