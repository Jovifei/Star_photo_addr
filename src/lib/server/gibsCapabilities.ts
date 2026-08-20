import { GIBS_CAPABILITIES_URL } from "@/lib/gibs";

export type GibsCapabilitiesCacheState =
  | "memory"
  | "refresh"
  | "coalesced"
  | "refresh-cooldown"
  | "stale-memory";

export class GibsRefreshCooldownError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("GIBS 强制刷新处于冷却保护，请稍后重试");
    this.name = "GibsRefreshCooldownError";
  }
}

export interface GibsCapabilitiesResult {
  xml: string;
  stale: boolean;
  cache: GibsCapabilitiesCacheState;
  refreshSuppressed?: boolean;
  retryAfterSeconds?: number;
}

interface GibsCapabilitiesState {
  cache: {
    xml: string;
    savedAt: number;
    expiresAt: number;
  } | null;
  inFlight: Promise<GibsCapabilitiesResult> | null;
  lastProbeStartedAt: number;
}

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

const globalForGibs = globalThis as typeof globalThis & {
  __starPhotoGibsCapabilities?: GibsCapabilitiesState;
};
const state =
  globalForGibs.__starPhotoGibsCapabilities ??
  (globalForGibs.__starPhotoGibsCapabilities = {
    cache: null,
    inFlight: null,
    lastProbeStartedAt: 0,
  });

function validCapabilities(xml: string): boolean {
  return xml.includes("<Capabilities") && xml.includes("ResourceURL");
}

async function fetchCapabilities(): Promise<GibsCapabilitiesResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GIBS_CAPABILITIES_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: "application/xml,text/xml",
        "User-Agent": "star-weather-planner-gibs/0.3.1",
      },
    });
    if (!response.ok) {
      throw new Error(`GIBS capabilities 返回 HTTP ${response.status}`);
    }
    const xml = await response.text();
    if (!validCapabilities(xml)) {
      throw new Error("GIBS capabilities 格式无法识别");
    }
    const now = Date.now();
    state.cache = {
      xml,
      savedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };
    return { xml, stale: false, cache: "refresh" };
  } catch (error) {
    if (state.cache && Date.now() - state.cache.savedAt <= STALE_TTL_MS) {
      return {
        xml: state.cache.xml,
        stale: true,
        cache: "stale-memory",
      };
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Shared process-local NASA GIBS catalogue loader used by both the satellite
 * endpoint and the data-source health endpoint. State is stored on globalThis
 * so separately bundled Next.js route entries still share one multi-MB XML
 * download, one in-flight promise and one stale fallback.
 */
export async function getGibsCapabilities(
  forceRefresh = false,
): Promise<GibsCapabilitiesResult> {
  const now = Date.now();
  if (!forceRefresh && state.cache && state.cache.expiresAt > now) {
    return { xml: state.cache.xml, stale: false, cache: "memory" };
  }

  if (state.inFlight) {
    const shared = await state.inFlight;
    return { ...shared, cache: "coalesced" };
  }

  if (
    forceRefresh &&
    now - state.lastProbeStartedAt < FORCE_REFRESH_COOLDOWN_MS
  ) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (state.lastProbeStartedAt + FORCE_REFRESH_COOLDOWN_MS - now) / 1000,
      ),
    );
    if (
      state.cache &&
      now - state.cache.savedAt <= STALE_TTL_MS
    ) {
      return {
        xml: state.cache.xml,
        stale: state.cache.expiresAt <= now,
        cache: "refresh-cooldown",
        refreshSuppressed: true,
        retryAfterSeconds,
      };
    }
    // A failed first forced probe must still consume the cooldown. Otherwise a
    // public caller can hammer the multi-megabyte catalogue while the cache is
    // cold simply by retrying refresh=1.
    throw new GibsRefreshCooldownError(retryAfterSeconds);
  }

  state.lastProbeStartedAt = now;
  state.inFlight = fetchCapabilities();
  try {
    return await state.inFlight;
  } finally {
    state.inFlight = null;
  }
}
