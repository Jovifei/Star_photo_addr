import { APP_VERSION } from "@/lib/appVersion";

export const dynamic = "force-dynamic";

/** Static declaration only: no weather load, cache write or supplier request. */
export function GET() {
  return Response.json({
    app: "star-weather-planner",
    version: APP_VERSION,
    buildRevision: process.env.NEXT_PUBLIC_BUILD_REVISION ?? process.env.GIT_COMMIT_SHA ?? "local",
    cacheOnlyVersion: 1,
    products: ["surface", "pressure", "fireglow", "cloudsea"],
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
