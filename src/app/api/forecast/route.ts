import { NextRequest, NextResponse } from "next/server";
import { fetchForecastByCoords } from "@/lib/forecast";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";

const MODELS = new Set<ForecastModel>(["best_match", "icon", "gfs", "aifs"]);

/** GET /api/forecast?latitude=...&longitude=...&days=...&model=... */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const latitudeRaw = searchParams.get("latitude") ?? searchParams.get("lat");
  const longitudeRaw = searchParams.get("longitude") ?? searchParams.get("lng");
  const modelRaw = searchParams.get("model") ?? "best_match";

  if (!latitudeRaw || !longitudeRaw) {
    return NextResponse.json({ error: "缺少 latitude 或 longitude 参数" }, { status: 400 });
  }
  if (!MODELS.has(modelRaw as ForecastModel)) {
    return NextResponse.json({ error: "model 必须是 best_match、icon、gfs 或 aifs" }, { status: 400 });
  }

  const latitudes = latitudeRaw.split(",").map((value) => Number(value.trim()));
  const longitudes = longitudeRaw.split(",").map((value) => Number(value.trim()));
  const validCoordinates =
    latitudes.length > 0 &&
    latitudes.length === longitudes.length &&
    latitudes.every((value) => Number.isFinite(value) && value >= -90 && value <= 90) &&
    longitudes.every((value) => Number.isFinite(value) && value >= -180 && value <= 180);

  if (!validCoordinates) {
    return NextResponse.json({ error: "latitude 和 longitude 必须是合法且一一对应的坐标" }, { status: 400 });
  }

  const daysRaw = Number(searchParams.get("days") ?? "14");
  const days = Number.isFinite(daysRaw) ? Math.min(16, Math.max(1, Math.floor(daysRaw))) : 14;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const data = await fetchForecastByCoords(
      latitudes,
      longitudes,
      days,
      controller.signal,
      modelRaw as ForecastModel,
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=1800",
        "X-Forecast-Model": modelRaw,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "天气数据请求失败";
    const status = controller.signal.aborted ? 504 : 502;
    return NextResponse.json({ error: message, stale: false }, { status });
  } finally {
    clearTimeout(timeout);
  }
}
