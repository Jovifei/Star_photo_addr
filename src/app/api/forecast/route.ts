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
const FRESH_TTL_MS = 10 * 60 * 1000;
const STALE_TTL_MS = 6 * 60 * 60 * 1000;
const forecastCache = new TimedCache<ForecastResponse>(192);

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
    latitudes.every(
      (value) => Number.isFinite(value) && value >= -90 && value <= 90,
    ) &&
    longitudes.every(
      (value) => Number.isFinite(value) && value >= -180 && value <= 180,
    );

  if (!validCoordinates) {
    return NextResponse.json(
      { error: "latitude 和 longitude 必须是合法且一一对应的坐标" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const model = modelRaw as ForecastModel;
  const daysRaw = Number(searchParams.get("days") ?? "14");
  const days = clampForecastDays(
    Number.isFinite(daysRaw) ? daysRaw : 14,
    model,
  );
  const key = `${model}|${days}|${latitudeRaw}|${longitudeRaw}`;
  const cached = forecastCache.read(key);

  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, {
      headers: {
        ...cacheHeaders(false),
        "X-Forecast-Cache": "memory",
        "X-Forecast-Model": model,
        "X-Forecast-Days": String(days),
        "X-Data-Stale": "false",
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    const data = await fetchForecastByCoords(
      latitudes,
      longitudes,
      days,
      controller.signal,
      model,
    );
    forecastCache.write(key, data);
    return NextResponse.json(data, {
      headers: {
        ...cacheHeaders(forceRefresh),
        "X-Forecast-Cache": "refresh",
        "X-Forecast-Model": model,
        "X-Forecast-Days": String(days),
        "X-Data-Stale": "false",
      },
    });
  } catch (error) {
    if (cached && cached.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(markStale(cached.value), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Forecast-Cache": "stale-memory",
          "X-Forecast-Model": model,
          "X-Forecast-Days": String(days),
          "X-Data-Stale": "true",
          Warning: '110 - "Response is stale"',
        },
      });
    }
    const message = controller.signal.aborted
      ? "天气数据请求超时"
      : error instanceof Error
        ? error.message
        : "天气数据请求失败";
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
