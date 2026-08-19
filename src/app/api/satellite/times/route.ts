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

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

const CACHE_TTL_MS = boundedInteger(
  "GIBS_CACHE_TTL_MS",
  15 * 60_000,
  30_000,
  2 * 60 * 60_000,
);
const STALE_TTL_MS = boundedInteger(
  "GIBS_STALE_TTL_MS",
  24 * 60 * 60_000,
  CACHE_TTL_MS,
  7 * 24 * 60 * 60_000,
);
const REQUEST_TIMEOUT_MS = boundedInteger(
  "GIBS_REQUEST_TIMEOUT_MS",
  15_000,
  3_000,
  120_000,
);
const FORCE_REFRESH_COOLDOWN_MS = boundedInteger(
  "GIBS_FORCE_REFRESH_COOLDOWN_MS",
  60_000,
  5_000,
  15 * 60_000,
);

type CapabilitiesCacheState =
  | "memory"
  | "refresh"
  | "coalesced"
  | "refresh-cooldown"
  | "stale-memory";

interface CapabilitiesResult {
  xml: string;
  stale: boolean;
  cache: CapabilitiesCacheState;
  refreshSuppressed?: boolean;
}

let capabilitiesCache: {
  xml: string;
  savedAt: number;
  expiresAt: number;
} | null = null;
let capabilitiesInFlight: Promise<CapabilitiesResult> | null = null;
let lastCapabilitiesProbeStartedAt = 0;

async function fetchCapabilities(signal: AbortSignal): Promise<CapabilitiesResult> {
  try {
    const response = await fetch(GIBS_CAPABILITIES_URL, {
      signal,
      cache: "no-store",
      headers: { Accept: "application/xml,text/xml" },
    });
    if (!response.ok) {
      throw new Error(`GIBS capabilities 返回 HTTP ${response.status}`);
    }
    const xml = await response.text();
    if (!xml.includes("<Capabilities") || !xml.includes("ResourceURL")) {
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

async function capabilities(
  signal: AbortSignal,
  forceRefresh: boolean,
): Promise<CapabilitiesResult> {
  const now = Date.now();
  if (
    !forceRefresh &&
    capabilitiesCache &&
    capabilitiesCache.expiresAt > now
  ) {
    return { xml: capabilitiesCache.xml, stale: false, cache: "memory" };
  }

  if (
    forceRefresh &&
    capabilitiesCache &&
    now - capabilitiesCache.savedAt <= STALE_TTL_MS &&
    now - lastCapabilitiesProbeStartedAt < FORCE_REFRESH_COOLDOWN_MS
  ) {
    return {
      xml: capabilitiesCache.xml,
      stale: capabilitiesCache.expiresAt <= now,
      cache: "refresh-cooldown",
      refreshSuppressed: true,
    };
  }

  if (capabilitiesInFlight) {
    const shared = await capabilitiesInFlight;
    return { ...shared, cache: "coalesced" };
  }

  lastCapabilitiesProbeStartedAt = now;
  capabilitiesInFlight = fetchCapabilities(signal);
  try {
    return await capabilitiesInFlight;
  } finally {
    capabilitiesInFlight = null;
  }
}

function safeSatelliteError(error: unknown, timedOut: boolean): string {
  if (timedOut) return "卫星时次请求超时";
  if (error instanceof Error) {
    const status = error.message.match(/HTTP (\d{3})/)?.[1];
    if (status) return `NASA GIBS 返回 HTTP ${status}`;
    if (/白名单图层|格式无法识别|未提供瓦片模板|未提供时次/.test(error.message)) {
      return error.message.slice(0, 180);
    }
  }
  return "卫星时次暂不可用";
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

  // The catalogue is global, but old clients may still send coordinates. When
  // either value is present both must be present and valid; Number(null) must
  // never silently turn a missing longitude into 0.
  const latRaw = request.nextUrl.searchParams.get("lat");
  const lngRaw = request.nextUrl.searchParams.get("lng");
  if ((latRaw === null) !== (lngRaw === null)) {
    return NextResponse.json(
      { error: "lat 和 lng 必须同时提供" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (latRaw !== null && lngRaw !== null) {
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
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
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
        },
      },
    );
  } catch (error) {
    const timedOut =
      controller.signal.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" || /aborted|timeout/i.test(error.message)));
    console.warn(
      `[api/satellite/times] ${timedOut ? "timeout" : "upstream failure"}`,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: safeSatelliteError(error, timedOut), stale: false },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } finally {
    clearTimeout(timeout);
  }
}
