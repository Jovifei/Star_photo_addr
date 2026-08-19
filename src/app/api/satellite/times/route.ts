import { NextRequest, NextResponse } from "next/server";
import {
  GIBS_CAPABILITIES_URL,
  GIBS_LAYERS,
  buildSatelliteFrame,
  extractLayerBlock,
  parseRecentTimeDimension,
  parseTileTemplate,
  parseTimeDimension,
} from "@/lib/gibs";

export const dynamic = "force-dynamic";
const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
let capabilitiesCache: {
  xml: string;
  savedAt: number;
  expiresAt: number;
} | null = null;

async function capabilities(
  signal: AbortSignal,
  forceRefresh: boolean,
): Promise<{ xml: string; stale: boolean; cache: "memory" | "refresh" | "stale-memory" }> {
  if (
    !forceRefresh &&
    capabilitiesCache &&
    capabilitiesCache.expiresAt > Date.now()
  ) {
    return { xml: capabilitiesCache.xml, stale: false, cache: "memory" };
  }
  try {
    const response = await fetch(GIBS_CAPABILITIES_URL, {
      signal,
      cache: "no-store",
      headers: { Accept: "application/xml,text/xml" },
    });
    if (!response.ok) {
      throw new Error(`GIBS capabilities 返回 ${response.status}`);
    }
    const xml = await response.text();
    if (!xml.includes("<Capabilities")) {
      throw new Error("GIBS capabilities 格式无法识别");
    }
    const now = Date.now();
    capabilitiesCache = {
      xml,
      savedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };
    return { xml, stale: false, cache: "refresh" };
  } catch (error) {
    if (
      capabilitiesCache &&
      Date.now() - capabilitiesCache.savedAt <= STALE_TTL_MS
    ) {
      return {
        xml: capabilitiesCache.xml,
        stale: true,
        cache: "stale-memory",
      };
    }
    throw error;
  }
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get(
    "kind",
  ) as keyof typeof GIBS_LAYERS;
  if (kind !== "cloud" && kind !== "night-lights") {
    return NextResponse.json(
      { error: "kind 只允许 cloud 或 night-lights" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Coordinates are retained for backwards compatibility but the GIBS time
  // catalogue is global; panning the map must not re-fetch capabilities.
  const latRaw = request.nextUrl.searchParams.get("lat");
  const lngRaw = request.nextUrl.searchParams.get("lng");
  if (latRaw !== null || lngRaw !== null) {
    const latitude = Number(latRaw);
    const longitude = Number(lngRaw);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "lat/lng 必须同时为合法坐标" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const capability = await capabilities(controller.signal, forceRefresh);
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
    const frameTimes =
      kind === "cloud"
        ? parseRecentTimeDimension(capability.xml, identifier)
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
        },
      },
    );
  } catch (error) {
    const message = controller.signal.aborted
      ? "卫星时次请求超时"
      : error instanceof Error
        ? error.message
        : "卫星时次请求失败";
    return NextResponse.json(
      { error: message, stale: false },
      {
        status: controller.signal.aborted ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
