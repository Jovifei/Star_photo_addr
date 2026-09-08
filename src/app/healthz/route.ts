import { APP_VERSION } from "@/lib/appVersion";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    app: "star-weather-planner",
    version: APP_VERSION,
    buildRevision: process.env.NEXT_PUBLIC_BUILD_REVISION ?? process.env.GIT_COMMIT_SHA ?? "local",
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
