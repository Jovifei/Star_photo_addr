import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/geocode";

export const dynamic = "force-dynamic";

/** GET /api/geocode?q=...&count=...&language=... */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const count = Number(searchParams.get("count") ?? "10");
  const requestedLanguage = searchParams.get("language") ?? "zh";
  const language = /^[a-z]{2}(?:-[A-Z]{2})?$/.test(requestedLanguage)
    ? requestedLanguage
    : "zh";

  if (!q) {
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (q.length > 100) {
    return NextResponse.json(
      { error: "搜索关键词不能超过 100 个字符" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const safeCount = Number.isFinite(count)
    ? Math.min(100, Math.max(1, Math.floor(count)))
    : 10;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const data = await searchPlaces(
      q,
      safeCount,
      language,
      controller.signal,
    );
    return NextResponse.json(data, {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    const message = controller.signal.aborted
      ? "地理编码请求超时"
      : error instanceof Error
        ? error.message
        : "地理编码请求失败";
    return NextResponse.json(
      { error: message, results: [] },
      {
        status: controller.signal.aborted ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
