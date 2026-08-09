import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
const KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";

export async function GET() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(KP_URL, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`NOAA Kp 接口返回 ${response.status}`);
    const raw = await response.json() as Array<Array<string>> | Array<Record<string, string | number | null>>;
    const rows = Array.isArray(raw[0])
      ? (raw as Array<Array<string>>).slice(1).map((row) => ({ time_tag: row[0], kp: row[1], observed: row[2], noaa_scale: row[3] }))
      : raw as Array<Record<string, string | number | null>>;
    const fetchedAt = new Date().toISOString();
    return NextResponse.json({
      metadata: { source: "NOAA SWPC", model: "global planetary Kp", fetchedAt, stale: false, units: { kp: "Kp" } },
      note: "这是全球行星 Kp 指数，不等同于当地极光概率。",
      frames: rows.map((row) => ({ time: row.time_tag, kp: row.kp != null ? Number(row.kp) : null, observed: row.observed === "1" || row.observed === "observed", noaaScale: row.noaa_scale ?? null })).filter((frame) => typeof frame.time === "string"),
    }, { headers: { "Cache-Control": "public, max-age=900, stale-while-revalidate=3600" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kp 数据请求失败", stale: false }, { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
