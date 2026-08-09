import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/**
 * GET /api/geocode
 * Proxies Open-Meteo geocoding server-side (keyless, global).
 * Query: q=<query>  count=<n>  language=<code>
 * Returns GeocodeResponse ({ results: GeocodeResult[] }).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const q = searchParams.get("q")?.trim() ?? "";
  const count = Number(searchParams.get("count") ?? "10");
  const language = searchParams.get("language") ?? "zh";

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  const safeCount = Number.isFinite(count)
    ? Math.min(100, Math.max(1, Math.floor(count)))
    : 10;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const data = await searchPlaces(q, safeCount, language, controller.signal);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "地理编码请求失败";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
