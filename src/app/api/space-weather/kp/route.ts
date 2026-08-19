import { NextRequest, NextResponse } from "next/server";
import { TimedCache } from "@/lib/serverCache";

export const dynamic = "force-dynamic";
const KP_URL =
  process.env.NOAA_KP_URL?.trim() ||
  "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json";
const FRESH_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 12 * 60 * 60 * 1000;

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

function finiteNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "1";
  const cached = cache.read("kp");
  if (!forceRefresh && cached && cached.ageMs <= FRESH_TTL_MS) {
    return NextResponse.json(cached.value, {
      headers: {
        "Cache-Control":
          "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
        "X-Kp-Cache": "memory",
        "X-Data-Stale": "false",
      },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(KP_URL, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`NOAA Kp 接口返回 ${response.status}`);
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
    cache.write("kp", payload);
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
        "X-Kp-Cache": "refresh",
        "X-Data-Stale": "false",
      },
    });
  } catch (error) {
    if (cached && cached.ageMs <= STALE_TTL_MS) {
      return NextResponse.json(
        {
          ...cached.value,
          metadata: { ...cached.value.metadata, stale: true },
        },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-Kp-Cache": "stale-memory",
            "X-Data-Stale": "true",
            Warning: '110 - "Response is stale"',
          },
        },
      );
    }
    const message = controller.signal.aborted
      ? "Kp 数据请求超时"
      : error instanceof Error
        ? error.message
        : "Kp 数据请求失败";
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
