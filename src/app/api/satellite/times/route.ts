import { NextRequest, NextResponse } from "next/server";
import {
  GIBS_LAYERS,
  buildSatelliteFrame,
  extractLayerBlock,
  parseRecentTimeDimension,
  parseTileTemplate,
  parseTimeDimension,
} from "@/lib/gibs";
import { parseCoordinatePair } from "@/lib/server/queryParams";
import {
  GibsRefreshCooldownError,
  getGibsCapabilities,
} from "@/lib/server/gibsCapabilities";

export const dynamic = "force-dynamic";

function safeSatelliteError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || /aborted|timeout/i.test(error.message)) {
      return "卫星时次请求超时";
    }
    const status = error.message.match(/HTTP (\d{3})/)?.[1];
    if (status) return `NASA GIBS 返回 HTTP ${status}`;
    if (
      /白名单图层|格式无法识别|未提供瓦片模板|未提供时次/.test(
        error.message,
      )
    ) {
      return error.message.slice(0, 180);
    }
  }
  return "卫星时次暂不可用";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind") as keyof typeof GIBS_LAYERS;
  if (kind !== "cloud" && kind !== "night-lights") {
    return NextResponse.json(
      { error: "kind 只允许 cloud 或 night-lights" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // The catalogue is global, but old clients may still send coordinates.
  const hasCoordinates = ["lat", "latitude", "lng", "longitude"].some(
    (name) => params.has(name),
  );
  if (hasCoordinates && !parseCoordinatePair(params)) {
    return NextResponse.json(
      { error: "lat/lng 必须同时为非空合法坐标" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const forceRefresh = params.get("refresh") === "1";
  try {
    const capability = await getGibsCapabilities(forceRefresh);
    const identifier = GIBS_LAYERS[kind];
    const block = extractLayerBlock(capability.xml, identifier);
    const template = block && parseTileTemplate(block);
    if (!template) {
      throw new Error(`GIBS 白名单图层未提供瓦片模板：${identifier}`);
    }
    const dimension = parseTimeDimension(capability.xml, identifier);
    if (!dimension.latest) {
      throw new Error(`GIBS 白名单图层未提供时次：${identifier}`);
    }
    const matrixSet =
      kind === "cloud"
        ? "GoogleMapsCompatible_Level6"
        : "GoogleMapsCompatible_Level8";
    const concreteTemplate = template.replaceAll(
      "{TileMatrixSet}",
      matrixSet,
    );
    const recentCloudTimes =
      kind === "cloud"
        ? parseRecentTimeDimension(capability.xml, identifier)
        : [];
    const frameTimes =
      kind === "cloud"
        ? recentCloudTimes.length
          ? recentCloudTimes
          : [dimension.latest]
        : [dimension.latest.slice(0, 10)];
    const frames = frameTimes.map((time) =>
      buildSatelliteFrame(kind, time, concreteTemplate),
    );

    return NextResponse.json(
      {
        kind,
        frames,
        frameIntervalMinutes: kind === "cloud" ? 10 : null,
        latestObservedAt: frames[0]?.observedAt ?? null,
        frameRange: {
          oldest: frames.at(-1)?.observedAt ?? null,
          newest: frames[0]?.observedAt ?? null,
        },
        updatedAt: new Date().toISOString(),
        stale: capability.stale,
        status: frames.length
          ? capability.stale
            ? "degraded"
            : "available"
          : "degraded",
        message: frames.length
          ? capability.stale
            ? "正在使用最近一次成功的 NASA GIBS 图层目录"
            : capability.refreshSuppressed
              ? "强制刷新处于冷却保护，继续使用最近目录"
              : undefined
          : "卫星时次暂不可用；这不代表现场没有云或光污染",
        coverage: frames[0]?.coverage ?? "不可用",
      },
      {
        headers: {
          "Cache-Control": forceRefresh
            ? "no-store, max-age=0"
            : "public, max-age=0, s-maxage=300, stale-while-revalidate=1800",
          "X-GIBS-Cache": capability.cache,
          "X-Data-Stale": String(capability.stale),
          "X-Refresh-Suppressed": String(
            Boolean(capability.refreshSuppressed),
          ),
          ...(capability.retryAfterSeconds
            ? { "Retry-After": String(capability.retryAfterSeconds) }
            : {}),
        },
      },
    );
  } catch (error) {
    if (error instanceof GibsRefreshCooldownError) {
      return NextResponse.json(
        { error: error.message, stale: false },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-GIBS-Cache": "refresh-cooldown",
            "X-Refresh-Suppressed": "true",
            "Retry-After": String(error.retryAfterSeconds),
          },
        },
      );
    }
    console.warn(
      "[api/satellite/times] upstream failure",
      error instanceof Error ? error.message : error,
    );
    const message = safeSatelliteError(error);
    return NextResponse.json(
      { error: message, stale: false },
      {
        status: /超时/.test(message) ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
