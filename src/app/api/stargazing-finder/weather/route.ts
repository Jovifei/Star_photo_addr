import { NextRequest, NextResponse } from "next/server";
import { getShanghaiDate } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import {
  fetchFinderWeather,
  isFinderDateAllowed,
} from "@/lib/stargazingFinderWeather";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_MODELS = new Set<ForecastModel>([
  "best_match",
  "icon",
  "gfs",
  "aifs",
]);

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

const REQUEST_TIMEOUT_MS = boundedInteger(
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
const inFlight = new Map<
  string,
  ReturnType<typeof fetchFinderWeather>
>();
const lastForcedRefreshAt = new Map<string, number>();

function trimRefreshMap(): void {
  while (lastForcedRefreshAt.size > 32) {
    const oldest = lastForcedRefreshAt.keys().next().value as
      | string
      | undefined;
    if (oldest === undefined) break;
    lastForcedRefreshAt.delete(oldest);
  }
}

function noStoreError(message: string, status: number) {
  return NextResponse.json(
    { error: message, stale: false },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? getShanghaiDate();
  const modelRaw =
    request.nextUrl.searchParams.get("model") ?? "best_match";
  if (!isFinderDateAllowed(date)) {
    return noStoreError("date 必须是当前观测日附近的合法日期", 400);
  }
  if (!VALID_MODELS.has(modelRaw as ForecastModel)) {
    return noStoreError(
      "model 必须是 best_match、icon、gfs 或 aifs",
      400,
    );
  }

  const model = modelRaw as ForecastModel;
  const forceRefreshRequested =
    request.nextUrl.searchParams.get("refresh") === "1";
  const familyKey = `${date}|${model}`;
  const now = Date.now();
  const lastForcedRefresh = lastForcedRefreshAt.get(familyKey) ?? 0;
  const refreshSuppressed =
    forceRefreshRequested &&
    now - lastForcedRefresh < FORCE_REFRESH_COOLDOWN_MS;
  const effectiveForceRefresh =
    forceRefreshRequested && !refreshSuppressed;

  if (effectiveForceRefresh) {
    lastForcedRefreshAt.delete(familyKey);
    lastForcedRefreshAt.set(familyKey, now);
    trimRefreshMap();
  }

  let activeTask = inFlight.get(familyKey) ?? null;
  const cacheState = activeTask
    ? "coalesced"
    : refreshSuppressed
      ? "refresh-cooldown"
      : effectiveForceRefresh
        ? "refresh"
        : "default";

  if (!activeTask) {
    activeTask = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );
      try {
        return await fetchFinderWeather(
          date,
          controller.signal,
          effectiveForceRefresh,
          model,
        );
      } finally {
        clearTimeout(timeout);
      }
    })();
    inFlight.set(familyKey, activeTask);
  }

  try {
    const response = await activeTask;
    const stale = Object.values(response.data).some(
      (entry) => entry.status === "stale" || entry.status === "error",
    );
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": forceRefreshRequested
          ? "no-store, max-age=0"
          : "public, max-age=0, s-maxage=600, stale-while-revalidate=1800",
        "X-Finder-Source": "Open-Meteo",
        "X-Finder-Cache": cacheState,
        "X-Data-Stale": String(stale || response.stale),
        "X-Refresh-Suppressed": String(refreshSuppressed),
        ...(refreshSuppressed
          ? {
              "Retry-After": String(
                Math.max(
                  1,
                  Math.ceil(
                    (lastForcedRefresh + FORCE_REFRESH_COOLDOWN_MS - now) /
                      1000,
                  ),
                ),
              ),
            }
          : {}),
      },
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /aborted|timeout|超时/i.test(error.message));
    return noStoreError(
      timedOut ? "观星天气请求超时" : "观星天气暂时不可用",
      timedOut ? 504 : 502,
    );
  } finally {
    if (inFlight.get(familyKey) === activeTask) {
      inFlight.delete(familyKey);
    }
  }
}
