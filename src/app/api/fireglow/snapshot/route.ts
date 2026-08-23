import { NextRequest, NextResponse } from "next/server";
import {
  getShanghaiDate,
} from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import { buildFireGlowSnapshot } from "@/lib/fireglow";
import type { FireGlowSnapshot } from "@/lib/fireglow";
import {
  fetchFinderWeatherRange,
  isFinderDateAllowed,
} from "@/lib/stargazingFinderWeather";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_MODELS = new Set<ForecastModel>(["best_match", "icon", "gfs", "aifs"]);
const TTL_MS = 30 * 60_000;
const TIMEOUT_MS = 120_000;

const cache = new Map<string, { snapshot: FireGlowSnapshot; at: number }>();
const inFlight = new Map<string, Promise<FireGlowSnapshot>>();
const CACHE_MAX_ENTRIES = 32;

function rememberSnapshot(key: string, snapshot: FireGlowSnapshot) {
  cache.set(key, { snapshot, at: Date.now() });
  // Insertion-ordered map: drop the oldest entries past the cap.
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? getShanghaiDate();
  const model = (params.get("model") ?? "icon") as ForecastModel;

  if (!isFinderDateAllowed(date) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date 必须是当前日期附近的合法日期" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!VALID_MODELS.has(model)) {
    return NextResponse.json(
      { error: "model 必须是 best_match、icon、gfs 或 aifs" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = `${date}|${model}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json(cached.snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": "memory",
      },
    });
  }

  let activeTask = inFlight.get(key) ?? null;
  if (!activeTask) {
    activeTask = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const weather = await fetchFinderWeatherRange([date], controller.signal, false, model);
        const weatherByDate = Object.fromEntries(
          Object.entries(weather).map(([night, response]) => [night, response.data]),
        );
        return buildFireGlowSnapshot(date, model, weatherByDate);
      } finally {
        clearTimeout(timeout);
      }
    })();
    inFlight.set(key, activeTask);
    activeTask.finally(() => {
      if (inFlight.get(key) === activeTask) inFlight.delete(key);
    }).catch(() => undefined);
  }

  try {
    const snapshot = await activeTask;
    rememberSnapshot(key, snapshot);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": "fresh",
      },
    });
  } catch (error) {
    const fallback = cache.get(key);
    if (fallback) {
      return NextResponse.json(fallback.snapshot, {
        headers: {
          "Cache-Control": "no-store",
          "X-Fireglow-Cache": "stale-memory",
        },
      });
    }
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message));
    return NextResponse.json(
      { error: timedOut ? "火烧云快照请求超时" : "火烧云快照暂时不可用" },
      { status: timedOut ? 504 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
