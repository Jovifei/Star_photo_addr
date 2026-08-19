import { NextRequest, NextResponse } from "next/server";
import {
  addFinderDays,
  getShanghaiDate,
} from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import { buildObservationSnapshot } from "@/lib/observingSites";
import {
  markSnapshotStale,
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
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

const SNAPSHOT_TTL_MS = boundedInteger(
  "OBSERVATION_SNAPSHOT_TTL_MS",
  30 * 60_000,
  60_000,
  6 * 60 * 60_000,
);
const SNAPSHOT_STALE_TTL_MS = boundedInteger(
  "OBSERVATION_SNAPSHOT_STALE_TTL_MS",
  6 * 60 * 60_000,
  SNAPSHOT_TTL_MS,
  48 * 60 * 60_000,
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

function trimRefreshHistory(): void {
  while (lastForcedRefreshAt.size > 64) {
    const oldest = lastForcedRefreshAt.keys().next().value as
      | string
      | undefined;
    if (!oldest) break;
    lastForcedRefreshAt.delete(oldest);
  }
}

function safeSnapshotError(error: unknown, timedOut: boolean): string {
  if (timedOut) return "观星快照请求超时";
  if (error instanceof Error) {
    const status = error.message.match(/HTTP\s+(\d{3})/i)?.[1];
    if (status) return `观星天气上游返回 HTTP ${status}`;
  }
  return "观星快照暂不可用";
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

  const focusTimeRaw = params.get("time");
  if (
    params.has("time") &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(focusTimeRaw ?? "")
  ) {
    return jsonError("time 必须是 YYYY-MM-DDTHH:mm", 400);
  }
  const focusTime = focusTimeRaw ?? undefined;
  const key = observationSnapshotKey(date, days, model, focusTime);
  const forceRefresh = params.get("refresh") === "1";
  const now = Date.now();
  const cached = await readObservationSnapshot(key);
  const cachedAge = cached ? snapshotAgeMs(cached) : Number.POSITIVE_INFINITY;

  if (!forceRefresh && cached && cachedAge < SNAPSHOT_TTL_MS) {
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

  const lastForced = lastForcedRefreshAt.get(key) ?? 0;
  if (
    forceRefresh &&
    cached &&
    cachedAge <= SNAPSHOT_STALE_TTL_MS &&
    now - lastForced < FORCE_REFRESH_COOLDOWN_MS
  ) {
    const stale = cachedAge >= SNAPSHOT_TTL_MS || cached.stale;
    return NextResponse.json(stale ? markSnapshotStale(cached) : cached, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Observation-Cache": "refresh-cooldown",
        "X-Data-Stale": String(stale),
        "X-Refresh-Suppressed": "true",
      },
    });
  }

  let activeTask = inFlight.get(key);
  let cacheState = "coalesced";
  if (!activeTask) {
    cacheState = "refresh";
    if (forceRefresh) {
      lastForcedRefreshAt.set(key, now);
      trimRefreshHistory();
    }
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SNAPSHOT_TIMEOUT_MS,
    );
    activeTask = (async () => {
      try {
        const weather = await fetchFinderWeatherRange(
          dates,
          controller.signal,
          forceRefresh,
          model,
        );
        const weatherByDate = Object.fromEntries(
          Object.entries(weather).map(([night, response]) => [
            night,
            response.data,
          ]),
        );
        const snapshot = buildObservationSnapshot(
          date,
          days,
          model,
          weatherByDate,
          focusTime,
        );
        await writeObservationSnapshot(key, snapshot);
        return snapshot;
      } finally {
        clearTimeout(timeout);
      }
    })();
    inFlight.set(key, activeTask);
    void activeTask
      .finally(() => {
        if (inFlight.get(key) === activeTask) inFlight.delete(key);
      })
      .catch(() => undefined);
  }

  try {
    const snapshot = await activeTask;
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
        "X-Observation-Source":
          "Open-Meteo + curated dark-sky site metadata",
        "X-Observation-Cache": cacheState,
        "X-Data-Stale": "false",
        "X-Refresh-Suppressed": "false",
      },
    });
  } catch (error) {
    const fallback = await readObservationSnapshot(key);
    if (fallback && snapshotAgeMs(fallback) <= SNAPSHOT_STALE_TTL_MS) {
      return NextResponse.json(markSnapshotStale(fallback), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Observation-Cache": "stale-disk",
          "X-Data-Stale": "true",
          "X-Refresh-Suppressed": "false",
        },
      });
    }
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message));
    console.warn(
      `[api/observing/snapshot] ${timedOut ? "timeout" : "upstream failure"}`,
      error instanceof Error ? error.message : error,
    );
    return jsonError(safeSnapshotError(error, timedOut), timedOut ? 504 : 502);
  }
}
