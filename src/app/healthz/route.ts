export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    app: "star-weather-planner",
    version: process.env.npm_package_version ?? "0.3.1",
  });
}
