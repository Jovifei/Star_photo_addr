import { snapshotSourceAgeMs, snapshotTransport } from "@/lib/snapshotProvenance";
import { currentOpenMeteoRateLimit, openMeteoRateLimitHeaders } from "@/lib/forecast";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { getShanghaiDate } from "@/data/observingSites/catalog";
import { buildFireGlowSnapshot } from "@/lib/fireglow";
import type { FireGlowSnapshot } from "@/lib/fireglow";
import {
  fetchFinderWeatherRange,
  isFinderDateAllowed,
} from "@/lib/stargazingFinderWeather";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";
function snapshotJson(value: unknown, init?: ResponseInit) {
  if (value && typeof value === "object" && "sites" in value && "generatedAt" in value) {
    const snapshot = value as { generatedAt: string; stale?: boolean; provenance?: import("@/lib/snapshotProvenance").SnapshotProvenance };
    return NextResponse.json(snapshotTransport({ ...snapshot, stale: Boolean(snapshot.stale) || !Number.isFinite(snapshotSourceAgeMs(snapshot.provenance)) }), init);
  }
  return NextResponse.json(value, init);
}


const VALID_MODELS = new Set<ForecastModel>(["best_match", "icon", "gfs", "aifs"]);
const TTL_MS = 30 * 60_000;
const TIMEOUT_MS = 120_000;
/** Forced refreshes per date|model are throttled so page retries and the
 * worker cannot stampede the upstream quota. */
const FORCE_REFRESH_COOLDOWN_MS = 60_000;
const DISK_STALE_TTL_MS = 24 * 60 * 60_000;

// This path is intentionally runtime-configurable because production mounts a
// persistent volume at OBSERVING_SNAPSHOT_DIR. The turbopackIgnore annotations
// below prevent build-time tracing from treating that runtime path as a reason
// to include the whole repository in the server output.
const SNAPSHOT_DIRECTORY =
  process.env.OBSERVING_SNAPSHOT_DIR ??
  path.join(process.cwd(), "data", "snapshots");

function fireglowDiskPath(date: string, model: string): string {
  return path.join(SNAPSHOT_DIRECTORY, `fireglow-source-v1-${date}-${model}.json`);
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
    if (newCount === 0) return;
    const existing = readFireglowFromDisk(date, model);
    const existingCount = countValidScores(existing);

    // Snapshot armor: never overwrite valid disk snapshot with degraded/empty 429 results
    if (existingCount > 0 && newCount < existingCount * 0.7) {
      return;
    }

    if (!fs.existsSync(/*turbopackIgnore: true*/ SNAPSHOT_DIRECTORY)) {
      fs.mkdirSync(/*turbopackIgnore: true*/ SNAPSHOT_DIRECTORY, { recursive: true });
    }
    const finalPath = fireglowDiskPath(date, model);
    const tempPath = `${finalPath}.tmp.${Date.now()}`;
    fs.writeFileSync(/*turbopackIgnore: true*/ tempPath, JSON.stringify(snapshot), "utf-8");
    fs.renameSync(
      /*turbopackIgnore: true*/ tempPath,
      /*turbopackIgnore: true*/ finalPath,
    );
  } catch {
    // Ignore error
  }
}

function readFireglowFromDisk(date: string, model: string): FireGlowSnapshot | null {
  if (process.env.NODE_ENV === "test") return null;
  try {
    const currentPath = fireglowDiskPath(date, model);
    const legacyPath = path.join(SNAPSHOT_DIRECTORY, `fireglow-snapshot-${date}-${model}.json`);
    const filePath = fs.existsSync(/*turbopackIgnore: true*/ currentPath) ? currentPath : legacyPath;
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) return null;
    const content = fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf-8");
    const snapshot = JSON.parse(content) as FireGlowSnapshot;
    return snapshot?.date === date && snapshot.model === model && snapshot.sites && typeof snapshot.sites === "object" ? snapshot : null;
  } catch {
    return null;
  }
}

export function fireglowSnapshotAgeMs(snapshot: FireGlowSnapshot): number {
  const generatedAt = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - generatedAt, snapshotSourceAgeMs(snapshot.provenance));
}

function readUsableFireglowDiskSnapshot(date: string, model: string): FireGlowSnapshot | null {
  const snapshot = readFireglowFromDisk(date, model);
  return snapshot && countValidScores(snapshot) > 0 && Number.isFinite(Date.parse(snapshot.generatedAt)) && Math.max(0, Date.now() - Date.parse(snapshot.generatedAt)) <= DISK_STALE_TTL_MS
    ? snapshot
    : null;
}

const cache = new Map<string, { snapshot: FireGlowSnapshot; at: number }>();
const inFlight = new Map<string, Promise<FireGlowSnapshot>>();
const lastForceAt = new Map<string, number>();
const CACHE_MAX_ENTRIES = 32;

function rememberSnapshot(key: string, date: string, model: string, snapshot: FireGlowSnapshot) {
  const newCount = countValidScores(snapshot);
  if (newCount === 0) return;
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
    return snapshotJson(
      { error: "date 必须是当前日期附近的合法日期" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!VALID_MODELS.has(model)) {
    return snapshotJson(
      { error: "model 必须是 best_match、icon、gfs 或 aifs" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const key = `source-v1|${date}|${model}`;
  const diskCached = readUsableFireglowDiskSnapshot(date, model);
  if (params.get("cache_only") === "1") {
    const retained = cache.get(key)?.snapshot ?? diskCached;
    if (!retained) return snapshotJson({ error: "cache-only-miss" }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60", "X-Fireglow-Cache": "cache-only-miss" } });
    return snapshotJson({ ...retained, stale: Boolean(retained.stale) || snapshotSourceAgeMs(retained.provenance) > TTL_MS }, { headers: { "Cache-Control": "no-store", "X-Fireglow-Cache": "cache-only" } });
  }
  if (forceRefresh) {
    const last = lastForceAt.get(key) ?? 0;
    const elapsed = Date.now() - last;
    if (elapsed < FORCE_REFRESH_COOLDOWN_MS) {
      const localRetryAfterSeconds = Math.ceil(
        (FORCE_REFRESH_COOLDOWN_MS - elapsed) / 1000,
      );
      const cached = cache.get(key);
      const cooldownFallback = cached?.snapshot ?? diskCached;
      if (cooldownFallback) {
        return snapshotJson(
          { ...cooldownFallback, stale: true, refreshError: "强制刷新冷却中" },
          {
            headers: {
              "Cache-Control": "no-store",
              "X-Fireglow-Cache": "refresh-cooldown",
              ...openMeteoRateLimitHeaders(localRetryAfterSeconds),
            },
          },
        );
      }
      return snapshotJson(
        { error: "火烧云强制刷新处于冷却保护，请稍后重试" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-Fireglow-Cache": "refresh-cooldown",
            ...openMeteoRateLimitHeaders(localRetryAfterSeconds),
          },
        },
      );
    } else {
      lastForceAt.set(key, Date.now());
    }
  }

  const cached = cache.get(key);
  if (cached && fireglowSnapshotAgeMs(cached.snapshot) < TTL_MS && !forceRefresh) {
    return snapshotJson(cached.snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": "memory",
      },
    });
  }

  if (!cached && diskCached && !forceRefresh && fireglowSnapshotAgeMs(diskCached) <= TTL_MS) {
    const ageMs = fireglowSnapshotAgeMs(diskCached);
    cache.set(key, { snapshot: diskCached, at: Date.now() - ageMs });
    return snapshotJson(diskCached, {
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
        const snapshot = buildFireGlowSnapshot(date, model, weatherByDate);
        if (countValidScores(snapshot) === 0) {
          const providerError = Object.values(weather[date]?.data ?? {})
            .map((record) => record.error)
            .find((message): message is string => Boolean(message));
          throw new Error(providerError ?? "上游未返回有效火烧云评分");
        }
        return snapshot;
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
    const memoryFallback = cache.get(key)?.snapshot;
    const latestDisk = readUsableFireglowDiskSnapshot(date, model);
    const diskFallback =
      memoryFallback && countValidScores(memoryFallback) > 0
        ? memoryFallback
        : diskCached ?? latestDisk;
    const diskCount = countValidScores(diskFallback);

    if (newCount === 0) {
      if (diskCount > 0) {
        return snapshotJson(
          {
            ...diskFallback!,
            stale: true,
            refreshError: "上游未返回有效火烧云评分，已保留最近成功快照",
          },
          {
            headers: {
              "Cache-Control": "no-store",
              ...openMeteoRateLimitHeaders(),
              "X-Fireglow-Cache": "empty-protected-fallback",
            },
          },
        );
      }
      const limit = currentOpenMeteoRateLimit();
      if (limit) return snapshotJson({ error: limit.message }, { status: 429, headers: { "Cache-Control": "no-store", ...openMeteoRateLimitHeaders() } });
      return snapshotJson(
        { error: "上游未返回有效火烧云评分，请稍后重试" },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (diskCount > 0 && newCount < diskCount * 0.7) {
      return snapshotJson(
        {
          ...diskFallback!,
          stale: true,
          refreshError: "上游限流或响应不足，已保留有效离线快照",
        },
        {
          headers: {
            "Cache-Control": "no-store",
              ...openMeteoRateLimitHeaders(),
            "X-Fireglow-Cache": "disk-protected-fallback",
          },
        },
      );
    }

    rememberSnapshot(key, date, model, snapshot);
    return snapshotJson(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Fireglow-Cache": forceRefresh ? "forced-fresh" : "fresh",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "火烧云上游请求失败";
    const fallback = cache.get(key)?.snapshot ?? diskCached;
    if (fallback) {
      const timedOut =
        error instanceof Error &&
        (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message));
      return snapshotJson(
        {
          ...fallback,
          stale: true,
          refreshError: timedOut
            ? "强制刷新超时，展示最近成功快照"
            : `强制刷新失败：${message}；展示最近成功快照`,
        },
        {
          headers: {
            "Cache-Control": "no-store",
              ...openMeteoRateLimitHeaders(),
            "X-Fireglow-Cache": "stale-fallback",
          },
        },
      );
    }
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message));
    const limit = currentOpenMeteoRateLimit();
    if (limit) return snapshotJson({ error: limit.message }, { status: 429, headers: { "Cache-Control": "no-store", ...openMeteoRateLimitHeaders() } });
    const providerMessage =
      error instanceof Error ? error.message : "火烧云上游请求失败";
    return snapshotJson(
      {
        error: timedOut
          ? "火烧云快照请求超时"
          : `火烧云数据不可用：${providerMessage}`,
      },
      { status: timedOut ? 504 : 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
