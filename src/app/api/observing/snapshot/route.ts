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
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;
const inFlight = new Map<string, Promise<ObservationSnapshot>>();

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
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
  const forceRefresh = params.get("refresh") === "1";
  let activeTask: Promise<ObservationSnapshot> | null = null;
  try {
    const cached = await readObservationSnapshot(key);
    if (
      !forceRefresh &&
      cached &&
      snapshotAgeMs(cached) < SNAPSHOT_TTL_MS
    ) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control":
            "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
          "X-Observation-Cache": "disk",
        },
      });
    }

    activeTask = inFlight.get(key) ?? null;
    if (!activeTask) {
      activeTask = (async () => {
        const sharedController = new AbortController();
        const sharedTimeout = setTimeout(
          () => sharedController.abort(),
          120_000,
        );
        try {
          const weather = await fetchFinderWeatherRange(
            dates,
            sharedController.signal,
            forceRefresh,
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
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": forceRefresh
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=300, stale-while-revalidate=900",
        "X-Observation-Source":
          "Open-Meteo + curated dark-sky site metadata",
        "X-Observation-Cache": "refresh",
      },
    });
  } catch (error) {
    const fallback = await readObservationSnapshot(key);
    if (fallback) {
      return NextResponse.json(markSnapshotStale(fallback), {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Observation-Cache": "stale-disk",
          "X-Data-Stale": "true",
        },
      });
    }
    const message = error instanceof Error ? error.message : "观星快照请求失败";
    return jsonError(message, /aborted|timeout|超时/i.test(message) ? 504 : 502);
  } finally {
    if (activeTask && inFlight.get(key) === activeTask) {
      inFlight.delete(key);
    }
  }
}
