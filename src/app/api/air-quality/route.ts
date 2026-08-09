import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitude = Number(params.get("latitude") ?? params.get("lat"));
  const longitude = Number(params.get("longitude") ?? params.get("lng"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "必须提供合法 latitude 和 longitude" }, { status: 400 });
  }
  const daysRaw = Number(params.get("days") ?? "2");
  const days = Number.isFinite(daysRaw) ? Math.min(5, Math.max(1, Math.floor(daysRaw))) : 2;
  const upstream = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  upstream.searchParams.set("latitude", String(latitude));
  upstream.searchParams.set("longitude", String(longitude));
  upstream.searchParams.set("hourly", "us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide");
  upstream.searchParams.set("timezone", "auto");
  upstream.searchParams.set("forecast_days", String(days));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(upstream, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`空气质量接口返回 ${response.status}`);
    const data = await response.json() as { hourly?: Record<string, (number | string | null)[]> };
    if (!Array.isArray(data.hourly?.time)) throw new Error("空气质量上游返回了无法识别的 hourly 数据");
    const fetchedAt = new Date().toISOString();
    return NextResponse.json({
      metadata: { source: "Open-Meteo CAMS", model: "cams", fetchedAt, stale: false, units: { usAqi: "US AQI", pm2_5: "μg/m³", pm10: "μg/m³" } },
      hourly: data.hourly.time.map((time, index) => ({ time, usAqi: data.hourly?.us_aqi?.[index] ?? null, pm2_5: data.hourly?.pm2_5?.[index] ?? null, pm10: data.hourly?.pm10?.[index] ?? null, ozone: data.hourly?.ozone?.[index] ?? null, nitrogenDioxide: data.hourly?.nitrogen_dioxide?.[index] ?? null, sulphurDioxide: data.hourly?.sulphur_dioxide?.[index] ?? null })),
    }, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1800" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "空气质量数据请求失败", stale: false }, { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
