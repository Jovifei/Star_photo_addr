import { NextRequest, NextResponse } from "next/server";
import { fetchPressureForecast } from "@/lib/pressure";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";
const MODELS = new Set<ForecastModel>(["best_match", "icon", "gfs", "aifs"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const latitude = Number(params.get("latitude") ?? params.get("lat"));
  const longitude = Number(params.get("longitude") ?? params.get("lng"));
  const model = (params.get("model") ?? "best_match") as ForecastModel;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "必须提供合法 latitude 和 longitude" }, { status: 400 });
  }
  if (!MODELS.has(model)) return NextResponse.json({ error: "不支持的 forecast model" }, { status: 400 });
  const daysRaw = Number(params.get("days") ?? "7");
  const days = Number.isFinite(daysRaw) ? Math.min(16, Math.max(1, Math.floor(daysRaw))) : 7;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const data = await fetchPressureForecast(latitude, longitude, days, controller.signal, model);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=600, stale-while-revalidate=1800" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "气压数据请求失败", stale: false }, { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
