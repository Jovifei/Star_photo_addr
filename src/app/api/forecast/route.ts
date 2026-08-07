import { NextRequest, NextResponse } from "next/server";
import { fetchForecastByCoords } from "@/lib/forecast";

export const dynamic = "force-dynamic";

/**
 * GET /api/forecast
 * Proxies Open-Meteo forecast server-side.
 * Query: latitude=lat1,lat2  longitude=lon1,lon2  days=1..16
 * Returns ForecastResponse ({ locations: LocationForecast[] }).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const latitudeRaw = searchParams.get("latitude");
  const longitudeRaw = searchParams.get("longitude");
  const daysRaw = Number(searchParams.get("days") ?? "14");

  if (!latitudeRaw || !longitudeRaw) {
    return NextResponse.json(
      { error: "缺少 latitude 或 longitude 参数" },
      { status: 400 },
    );
  }

  const latitudes = latitudeRaw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  const longitudes = longitudeRaw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  if (latitudes.length === 0 || latitudes.length !== longitudes.length) {
    return NextResponse.json(
      { error: "latitude 与 longitude 必须一一对应" },
      { status: 400 },
    );
  }

  const days = Number.isFinite(daysRaw)
    ? Math.min(16, Math.max(1, Math.floor(daysRaw)))
    : 14;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const data = await fetchForecastByCoords(
      latitudes,
      longitudes,
      days,
      controller.signal,
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=600" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "天气数据请求失败";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
