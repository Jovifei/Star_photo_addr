import { NextRequest, NextResponse } from "next/server";
import { TimedCache } from "@/lib/serverCache";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";

export const dynamic = "force-dynamic";

const KP_URL =
  process.env.NOAA_KP_URL?.trim() ||
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
const FRESH_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 12 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const FORCE_REFRESH_COOLDOWN_MS = 60_000;

interface KpPayload {
  metadata: {
    source: "NOAA SWPC";
    model: "global planetary Kp";
    fetchedAt: string;
    stale: boolean;
    units: { kp: "Kp" };
  };
  note: string;
  frames: Array<{
    time: string;
    kp: number | null;
    observed: boolean;
    noaaScale: string | number | null;
  }>;
}

const cache = new TimedCache<KpPayload>(4);
const coordinator = new RefreshCoordinator<KpPayload>(
  FORCE_REFRESH_COOLDOWN_MS,
  4,
);

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function responseHeaders(
  forceRefresh: boolean,
  cacheState: string,
  stale: boolean,
  refreshSuppressed: boolean,
  retryAfterSeconds: number | null,
): Record<string, string> {
  return {
    "Cache-Control": forceRefresh
      ? "no-store, max-age=0"
      : "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    "X-Kp-Cache": cacheState,
    "X-Data-Stale": String(stale),
    "X-Refresh-Suppressed": String(refreshSuppressed),
    ...(retryAfterSeconds
      ? { "Retry-After": String(retryAfterSeconds) }
      : {}),
  };
}

async function fetchKp(): Promise<KpPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(KP_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`NOAA Kp 接口返回 HTTP ${response.status}`);
    }
    const raw = (await response.json()) as
      | Array<Array<string>>
      | Array<Record<string, string | number | null>>;
    const rows = Array.isArray(raw[0])
      ? (raw as Array<Array<string>>).slice(1).map((row) => ({
          time_tag: row[0],
          kp: row[1],
          observed: row[2],
          noaa_scale: row[3],
        }))
      : (raw as Array<Record<string, string | number | null>>);
    const fetchedAt = new Date().toISOString();
    const payload: KpPayload = {
      metadata: {
        source: "NOAA SWPC",
        model: "global planetary Kp",
        fetchedAt,
        stale: false,
        units: { kp: "Kp" },
      },
      note: "这是全球行星 Kp 指数，不等同于当地极光概率。",
      frames: rows
        .map((row) => ({
          time: typeof row.time_tag === "string" ? row.time_tag : "",
          kp: finiteNumber(row.kp),
          observed:
            row.observed === "1" || row.observed === "observed",
          noaaScale: row.noaa_scale ?? null,
        }))
        .filter((frame) => frame.time.length > 0),
    };
    if (!payload.frames.length) {
      throw new Error("NOAA Kp 上游没有返回可用时次");
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const cached = cache.read("kp");
  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, {
      headers: responseHeaders(false, "memory", false, false, null),
    });
  }

  const decision = coordinator.decide("kp", forceRefresh);
  if (
    decision.suppressed &&
    cached &&
    cached.ageMs <= STALE_TTL_MS
  ) {
    const stale = cached.ageMs > FRESH_TTL_MS;
    const payload = stale
      ? {
          ...cached.value,
          metadata: { ...cached.value.metadata, stale: true },
        }
      : cached.value;
    return NextResponse.json(payload, {
      headers: responseHeaders(
        true,
        "refresh-cooldown",
        stale,
        true,
        decision.retryAfterSeconds,
      ),
    });
  }

  if (
    decision.suppressed &&
    !coordinator.hasInFlight("kp") &&
    (!cached || cached.ageMs > STALE_TTL_MS)
  ) {
    return NextResponse.json(
      { error: "Kp 强制刷新处于冷却保护，请稍后重试", stale: false },
      {
        status: 429,
        headers: responseHeaders(
          true,
          "refresh-cooldown",
          false,
          true,
          decision.retryAfterSeconds,
        ),
      },
    );
  }

  const coordinated = coordinator.run("kp", async () => {
    const payload = await fetchKp();
    cache.write("kp", payload);
    return payload;
  });

  try {
    const payload = await coordinated.promise;
    return NextResponse.json(payload, {
      headers: responseHeaders(
        forceRefresh,
        coordinated.coalesced ? "coalesced" : "refresh",
        false,
        decision.suppressed,
        decision.retryAfterSeconds,
      ),
    });
  } catch (error) {
    const fallback = cache.read("kp");
    if (fallback && fallback.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(
        {
          ...fallback.value,
          metadata: { ...fallback.value.metadata, stale: true },
        },
        {
          headers: {
            ...responseHeaders(
              true,
              "stale-memory",
              true,
              decision.suppressed,
              decision.retryAfterSeconds,
            ),
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout/i.test(error.message));
    return NextResponse.json(
      {
        error: timedOut ? "Kp 数据请求超时" : "Kp 数据暂时不可用",
        stale: false,
      },
      {
        status: timedOut ? 504 : 502,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
