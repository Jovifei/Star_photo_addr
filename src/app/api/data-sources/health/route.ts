import { NextRequest, NextResponse } from "next/server";
import { getDataSourceHealth } from "@/lib/dataSourceHealth";

export const dynamic = "force-dynamic";

/**
 * Provider diagnostics for operations and the in-app source panel.
 *
 * This endpoint is deliberately separate from /healthz: a transient upstream
 * outage should degrade data presentation, not restart an otherwise healthy
 * application container.
 */
export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const result = await getDataSourceHealth(forceRefresh);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": forceRefresh
        ? "no-store, max-age=0"
        : "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
