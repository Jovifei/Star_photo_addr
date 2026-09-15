import { NextRequest, NextResponse } from "next/server";
import { getDataSourceHealth } from "@/lib/dataSourceHealth";
import { DEFAULT_SCORING_MODEL, isForecastModel } from "@/lib/forecastPolicy";
import type { DataSourceHealthResponse } from "@/lib/dataSourceStatus";

// Route segment config must be declared as a local literal for Next.js to
// statically analyze it; re-exporting `dynamic` from another route breaks the
// production Turbopack build.
export const dynamic = "force-dynamic";

function responseHeaders(
  forceRefresh: boolean,
  data: DataSourceHealthResponse,
): Record<string, string> {
  const cacheState = data.refreshSuppressed
    ? "refresh-cooldown"
    : data.coalesced
      ? "coalesced"
      : data.cached
        ? "memory"
        : "refresh";
  const headers: Record<string, string> = {
    "Cache-Control": forceRefresh || data.status !== "ok"
      ? "no-store, max-age=0"
      : "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    Vary: "Accept-Encoding",
    "X-Data-Source-Cache": cacheState,
    "X-Refresh-Suppressed": String(Boolean(data.refreshSuppressed)),
  };
  if (data.nextRefreshAt) {
    headers["X-Next-Refresh-At"] = data.nextRefreshAt;
  }
  return headers;
}

/** Stable operator-facing alias for the data-source diagnostic endpoint. */
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const model = request.nextUrl.searchParams.get("model") ?? DEFAULT_SCORING_MODEL;
  if (!isForecastModel(model)) return NextResponse.json({ error: "model 必须是 best_match、icon、gfs 或 aifs" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const data = await getDataSourceHealth(forceRefresh, model);
  return NextResponse.json(data, {
    headers: { ...responseHeaders(forceRefresh, data), "X-Weather-Probe-Model": model },
  });
}
