export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    app: "star-weather-planner",
    version: process.env.npm_package_version ?? "1.0.0",
    buildRevision: process.env.NEXT_PUBLIC_BUILD_REVISION ?? process.env.GIT_COMMIT_SHA ?? "local",
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
