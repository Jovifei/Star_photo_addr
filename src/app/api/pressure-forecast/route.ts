import { NextRequest, NextResponse } from "next/server";
import { clampForecastDays } from "@/lib/forecast";
import {
  fetchPressureForecast,
  type PressureForecastResponse,
} from "@/lib/pressure";
import { TimedCache } from "@/lib/serverCache";
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
const pressureCache = new TimedCache<PressureForecastResponse>(128);

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
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
        "X-Pressure-Cache": "memory",
        "X-Data-Stale": "false",
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const data = await fetchPressureForecast(
      latitude,
      longitude,
      days,
      controller.signal,
      model,
    );
    pressureCache.write(key, data);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
        "X-Pressure-Cache": "refresh",
        "X-Data-Stale": "false",
      },
    });
  } catch (error) {
    if (cached && cached.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(
        { ...cached.value, stale: true },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-Pressure-Cache": "stale-memory",
            "X-Data-Stale": "true",
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const message = controller.signal.aborted
      ? "气压数据请求超时"
      : error instanceof Error
        ? error.message
        : "气压数据请求失败";
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
