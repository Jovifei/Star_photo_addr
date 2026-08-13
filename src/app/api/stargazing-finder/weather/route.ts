import { NextRequest, NextResponse } from "next/server";
import { getShanghaiDate } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import { fetchFinderWeather, isFinderDateAllowed } from "@/lib/stargazingFinderWeather";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? getShanghaiDate();
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  if (!isFinderDateAllowed(date)) {
    return NextResponse.json({ error: "date 必须是当前观测日附近的合法日期" }, { status: 400 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50000);
  try {
    const response = await fetchFinderWeather(date, controller.signal, forceRefresh);
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=900",
        "X-Finder-Source": "Open-Meteo",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "观星地点天气请求失败";
    return NextResponse.json({ error: message, stale: false }, { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}
