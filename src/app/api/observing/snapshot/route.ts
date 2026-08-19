import { NextRequest, NextResponse } from "next/server";
import {
  addFinderDays,
  getShanghaiDate,
} from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import { buildObservationSnapshot } from "@/lib/observingSites";
import {
  markSnapshotStale,
  observationRefreshFamilyKey,
  observationSnapshotKey,
  readObservationSnapshot,
  snapshotAgeMs,
  writeObservationSnapshot,
} from "@/lib/observingSnapshotStore";
import {
  fetchFinderWeatherRange,
  isFinderDateAllowed,
  isFinderRangeAllowedForModel,
} from "@/lib/stargazingFinderWeather";
import type { ForecastModel, ObservationSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_MODELS = new Set<ForecastModel>([
  "best_match",
  "icon",
  "gfs",
  "aifs",
]);
const VALID_DAYS = new Set<1 | 3 | 5 | 7>([1, 3, 5, 7]);

function boundedInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const value = Number(process.env[name]);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

const SNAPSHOT_TTL_MS = boundedInteger(
  "OBSERVATION_SNAPSHOT_TTL_MS",
  30 * 60_000,
  60_000,
  24 * 60 * 60_000,
);
const SNAPSHOT_STALE_TTL_MS = boundedInteger(
  "OBSERVATION_SNAPSHOT_STALE_TTL_MS",
  6 * 60 * 60_000,
  SNAPSHOT_TTL_MS,
  7 * 24 * 60 * 60_000,
);
const SNAPSHOT_TIMEOUT_MS = boundedInteger(
  "OBSERVATION_SNAPSHOT_TIMEOUT_MS",
  120_000,
  10_000,
  5 * 60_000,
);
const FORCE_REFRESH_COOLDOWN_MS = boundedInteger(
  "OBSERVATION_SNAPSHOT_FORCE_REFRESH_COOLDOWN_MS",
  60_000,
  5_000,
  15 * 60_000,
);
const inFlight = new Map<string, Promise<ObservationSnapshot>>();
const lastForcedRefreshAt = new Map<string, number>();

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function trimRefreshMap(): void {
  while (lastForcedRefreshAt.size > 64) {
    const oldest = lastForcedRefreshAt.keys().next().value as
      | string
      | undefined;
    if (oldest === undefined) break;
    lastForcedRefreshAt.delete(oldest);
  }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? getShanghaiDate();
  const daysValue = Number(params.get("days") ?? "1");
  const model = (params.get("model") ?? "icon") as ForecastModel;

  if (!isFinderDateAllowed(date) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError("date 必须是当前观测日附近的合法日期", 400);
  }
  if (!VALID_DAYS.has(daysValue as 1 | 3 | 5 | 7)) {
    return jsonError("days 必须是 1、3、5 或 7", 400);
  }
  if (!VALID_MODELS.has(model)) {
    return jsonError("model 必须是 best_match、icon、gfs 或 aifs", 400);
  }

  const days = daysValue as 1 | 3 | 5 | 7;
  const dates = Array.from({ length: days }, (_, index) =>
    addFinderDays(date, index),
  );
  if (dates.some((item) => !isFinderDateAllowed(item))) {
    return jsonError("请求的夜晚范围超出可用预报窗口", 400);
  }
  if (!isFinderRangeAllowedForModel(dates, model)) {
    return jsonError(
      `${model.toUpperCase()} 预报时效不足以覆盖所选夜晚；请缩短范围或切换 GFS / Best Match`,
      400,
    );
  }

  const focusTime = params.get("time");
  const validFocusTime =
    focusTime && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(focusTime)
      ? focusTime
      : undefined;
  const key = observationSnapshotKey(date, days, model, validFocusTime);
  const refreshFamily = observationRefreshFamilyKey(date, model);
  const forceRefreshRequested = params.get("refresh") === "1";
  const now = Date.now();
  const lastForcedRefresh = lastForcedRefreshAt.get(refreshFamily) ?? 0;
  const refreshSuppressed =
    forceRefreshRequested &&
    now - lastForcedRefresh < FORCE_REFRESH_COOLDOWN_MS;
  const effectiveForceRefresh =
    forceRefreshRequested && !refreshSuppressed;

  let activeTask: Promise<ObservationSnapshot> | null = null;
  try {
    const cached = await readObservationSnapshot(key);
    const cachedAge = cached ? snapshotAgeMs(cached) : Number.POSITIVE_INFINITY;

    if (
      !forceRefreshRequested &&
      cached &&
      cachedAge < SNAPSHOT_TTL_MS
    ) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control":
            "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
          "X-Observation-Cache": "disk",
          "X-Data-Stale": String(cached.stale),
          "X-Refresh-Suppressed": "false",
        },
      });
    }

    if (
      refreshSuppressed &&
      cached &&
      cachedAge <= SNAPSHOT_STALE_TTL_MS
    ) {
      const stale = cachedAge >= SNAPSHOT_TTL_MS || cached.stale;
      const payload = stale ? markSnapshotStale(cached) : cached;
      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Observation-Cache": "refresh-cooldown",
          "X-Data-Stale": String(stale),
          "X-Refresh-Suppressed": "true",
          "Retry-After": String(
            Math.max(
              1,
              Math.ceil(
                (lastForcedRefresh + FORCE_REFRESH_COOLDOWN_MS - now) /
                  1000,
              ),
            ),
          ),
        },
      });
    }

    if (effectiveForceRefresh) {
      lastForcedRefreshAt.delete(refreshFamily);
      lastForcedRefreshAt.set(refreshFamily, now);
      trimRefreshMap();
    }

    activeTask = inFlight.get(key) ?? null;
    let cacheState = activeTask
      ? "coalesced"
      : refreshSuppressed
        ? "refresh-cooldown"
        : "refresh";
    if (!activeTask) {
      activeTask = (async () => {
        const sharedController = new AbortController();
        const sharedTimeout = setTimeout(
          () => sharedController.abort(),
          SNAPSHOT_TIMEOUT_MS,
        );
        try {
          const weather = await fetchFinderWeatherRange(
            dates,
            sharedController.signal,
            effectiveForceRefresh,
            model,
          );
          const weatherByDate = Object.fromEntries(
            Object.entries(weather).map(([night, response]) => [
              night,
              response.data,
            ]),
          );
          return buildObservationSnapshot(
            date,
            days,
            model,
            weatherByDate,
            validFocusTime,
          );
        } finally {
          clearTimeout(sharedTimeout);
        }
      })();
      inFlight.set(key, activeTask);
    }
    const snapshot = await activeTask;
    await writeObservationSnapshot(key, snapshot);
    if (cacheState === "coalesced" && refreshSuppressed) {
      cacheState = "refresh-cooldown";
    }
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": forceRefreshRequested
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
        "X-Observation-Source":
          "Open-Meteo + curated dark-sky site metadata",
        "X-Observation-Cache": cacheState,
        "X-Data-Stale": String(snapshot.stale),
        "X-Refresh-Suppressed": String(refreshSuppressed),
      },
    });
  } catch (error) {
    const fallback = await readObservationSnapshot(key);
    if (
      fallback &&
      snapshotAgeMs(fallback) <= SNAPSHOT_STALE_TTL_MS
    ) {
      return NextResponse.json(markSnapshotStale(fallback), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Observation-Cache": "stale-disk",
          "X-Data-Stale": "true",
          "X-Refresh-Suppressed": String(refreshSuppressed),
          Warning: '110 - "Response is stale"',
        },
      });
    }
    const message =
      error instanceof Error && /aborted|timeout|超时/i.test(error.message)
        ? "观星快照请求超时"
        : "观星快照暂时不可用";
    return jsonError(message, /超时/.test(message) ? 504 : 502);
  } finally {
    if (activeTask && inFlight.get(key) === activeTask) {
      inFlight.delete(key);
    }
  }
}
