import fs from "node:fs";
import path from "node:path";
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
/** Forced refreshes per date|model are throttled so page retries and the
 * worker cannot stampede the upstream quota. */
const FORCE_REFRESH_COOLDOWN_MS = 60_000;

const SNAPSHOT_DIRECTORY =
  process.env.OBSERVING_SNAPSHOT_DIR ??
  path.join(process.cwd(), "data", "snapshots");

function fireglowDiskPath(date: string, model: string): string {
  return path.join(SNAPSHOT_DIRECTORY, `fireglow-snapshot-${date}-${model}.json`);
}

function countValidScores(snapshot: FireGlowSnapshot | null | undefined): number {
  if (!snapshot?.sites) return 0;
  let count = 0;
  for (const s of Object.values(snapshot.sites)) {
    if (s?.evening?.score != null || s?.morning?.score != null) {
      count++;
    }
  }
  return count;
}

function saveFireglowToDisk(date: string, model: string, snapshot: FireGlowSnapshot) {
  if (process.env.NODE_ENV === "test") return;
  try {
    const newCount = countValidScores(snapshot);
    const existing = readFireglowFromDisk(date, model);
    const existingCount = countValidScores(existing);

    // Snapshot armor: never overwrite valid disk snapshot with degraded/empty 429 results
    if (existingCount > 0 && newCount < existingCount * 0.7) {
      return;
    }

    if (!fs.existsSync(SNAPSHOT_DIRECTORY)) {
      fs.mkdirSync(SNAPSHOT_DIRECTORY, { recursive: true });
    }
    const tempPath = `${fireglowDiskPath(date, model)}.tmp.${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(snapshot), "utf-8");
    fs.renameSync(tempPath, fireglowDiskPath(date, model));
  } catch {
    // Ignore error
  }
}

function readFireglowFromDisk(date: string, model: string): FireGlowSnapshot | null {
  if (process.env.NODE_ENV === "test") return null;
  try {
    const filePath = fireglowDiskPath(date, model);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as FireGlowSnapshot;
  } catch {
    return null;
  }
}

const cache = new Map<string, { snapshot: FireGlowSnapshot; at: number }>();
const inFlight = new Map<string, Promise<FireGlowSnapshot>>();
const lastForceAt = new Map<string, number>();
const CACHE_MAX_ENTRIES = 32;

function rememberSnapshot(key: string, date: string, model: string, snapshot: FireGlowSnapshot) {
  const newCount = countValidScores(snapshot);
  const existingMemory = cache.get(key)?.snapshot;
  const existingCount = countValidScores(existingMemory);

  // Keep existing memory snapshot if new one is mostly empty
  if (existingCount > 0 && newCount < existingCount * 0.7) {
    return;
  }

  cache.set(key, { snapshot, at: Date.now() });
  saveFireglowToDisk(date, model, snapshot);
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
  const forceRefresh = params.get("refresh") === "1";

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
  if (forceRefresh) {
    const last = lastForceAt.get(key) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < FORCE_REFRESH_COOLDOWN_MS) {
      const cached = cache.get(key);
      if (cached) {
        return NextResponse.json(
          { ...cached.snapshot, stale: true, refreshError: "强制刷新冷却中" },
          {
            headers: {
              "Cache-Control": "no-store",
              "X-Fireglow-Cache": "refresh-cooldown",
              "Retry-After": String(Math.ceil((FORCE_REFRESH_COOLDOWN_MS - elapsed) / 1000)),
            },
          },
        );
      }
    } else {
      lastForceAt.set(key, Date.now());
    }
  }

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS && !forceRefresh) {
    return NextResponse.json(cached.snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": "memory",
      },
    });
  }

  const diskCached = readFireglowFromDisk(date, model);
  if (!cached && diskCached && !forceRefresh) {
    cache.set(key, { snapshot: diskCached, at: Date.now() });
    return NextResponse.json(diskCached, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": "disk",
      },
    });
  }

  let activeTask = inFlight.get(key) ?? null;
  if (!activeTask) {
    activeTask = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const weather = await fetchFinderWeatherRange([date], controller.signal, Boolean(forceRefresh), model);
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
    const newCount = countValidScores(snapshot);
    const diskFallback = diskCached ?? readFireglowFromDisk(date, model);
    const diskCount = countValidScores(diskFallback);

    if (diskCount > 0 && newCount < diskCount * 0.7) {
      return NextResponse.json(
        {
          ...diskFallback!,
          stale: true,
          refreshError: "上游限流或响应不足，已保留有效离线快照",
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Fireglow-Cache": "disk-protected-fallback",
          },
        },
      );
    }

    rememberSnapshot(key, date, model, snapshot);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": forceRefresh ? "forced-fresh" : "fresh",
      },
    });
  } catch (error) {
    const fallback = cache.get(key)?.snapshot ?? diskCached;
    if (fallback) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message));
      return NextResponse.json(
        {
          ...fallback,
          stale: true,
          refreshError: timedOut ? "强制刷新超时，展示最近成功快照" : "强制刷新失败，展示最近成功快照",
        },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Fireglow-Cache": "stale-fallback",
          },
        },
      );
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

