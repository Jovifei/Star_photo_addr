import { NextRequest, NextResponse } from "next/server";
import { getShanghaiDate } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { buildCloudSeaSnapshot, type CloudSeaSnapshot, type RawSiteHourly } from "@/lib/cloudsea";
import { applyOpenMeteoApiKey, OPEN_METEO_FORECAST_URL } from "@/lib/forecast";
import type { ForecastModel } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_MODELS = new Set<ForecastModel>(["best_match", "icon", "gfs", "aifs"]);
const TTL_MS = 30 * 60_000;
const TIMEOUT_MS = 40_000;
const FORCE_REFRESH_COOLDOWN_MS = 60_000;
const CACHE_MAX_ENTRIES = 32;

const cache = new Map<string, { snapshot: CloudSeaSnapshot; at: number }>();
const inFlight = new Map<string, Promise<CloudSeaSnapshot>>();
const lastForceAt = new Map<string, number>();

function rememberSnapshot(key: string, snapshot: CloudSeaSnapshot) {
  cache.set(key, { snapshot, at: Date.now() });
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function generateFallbackWeather(date: string): Record<string, RawSiteHourly> {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    times.push(`${date}T${hh}:00`);
  }

  const result: Record<string, RawSiteHourly> = {};
  for (const site of CLOUD_SEA_SITES) {
    const isHigh = site.altitude >= 1800;
    const baseLowCloud = isHigh ? 65 : 40;
    result[site.id] = {
      time: times,
      cloud_cover: times.map(() => baseLowCloud + 10),
      cloud_cover_low: times.map((_, i) => (i >= 5 && i <= 8 ? baseLowCloud + 10 : baseLowCloud)),
      cloud_cover_mid: times.map(() => 15),
      cloud_cover_high: times.map(() => 10),
      temperature_2m: times.map((_, i) => Math.round(18 - (site.altitude / 1000) * 6 + Math.sin(i / 4) * 5)),
      precipitation: times.map(() => 0),
      visibility: times.map(() => 25000),
      wind_speed_10m: times.map(() => 2.2),
    };
  }
  return result;
}

async function fetchCloudSeaWeather(
  date: string,
  model: ForecastModel,
  signal: AbortSignal,
): Promise<Record<string, RawSiteHourly>> {
  // Batch query all sites
  const lats = CLOUD_SEA_SITES.map((s) => s.latitude).join(",");
  const lngs = CLOUD_SEA_SITES.map((s) => s.longitude).join(",");

  const params = new URLSearchParams({
    latitude: lats,
    longitude: lngs,
    hourly: [
      "temperature_2m",
      "cloud_cover",
      "cloud_cover_low",
      "cloud_cover_mid",
      "cloud_cover_high",
      "precipitation",
      "visibility",
      "wind_speed_10m",
    ].join(","),
    timezone: "Asia/Shanghai",
    start_date: date,
    end_date: date,
  });

  if (model === "icon") {
    params.set("models", "icon_seamless");
  } else if (model === "gfs") {
    params.set("models", "gfs_seamless");
  }

  applyOpenMeteoApiKey(params);

  const url = `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Open-Meteo HTTP ${response.status}`);
      }

      const rawData = await response.json();
      const list = Array.isArray(rawData) ? rawData : [rawData];

      const result: Record<string, RawSiteHourly> = {};

      CLOUD_SEA_SITES.forEach((site, index) => {
        const entry = list[index];
        if (entry && entry.hourly) {
          result[site.id] = {
            time: entry.hourly.time ?? [],
            cloud_cover: entry.hourly.cloud_cover ?? [],
            cloud_cover_low: entry.hourly.cloud_cover_low ?? [],
            cloud_cover_mid: entry.hourly.cloud_cover_mid ?? [],
            cloud_cover_high: entry.hourly.cloud_cover_high ?? [],
            temperature_2m: entry.hourly.temperature_2m ?? [],
            precipitation: entry.hourly.precipitation ?? [],
            visibility: entry.hourly.visibility ?? [],
            wind_speed_10m: entry.hourly.wind_speed_10m ?? [],
          };
        }
      });

      if (Object.keys(result).length > 0) {
        return result;
      }
    } catch (err) {
      lastErr = err;
      if (signal.aborted) throw err;
    }
  }

  console.warn("Open-Meteo fetch failed after retries, using resilient fallback for", date, lastErr);
  return generateFallbackWeather(date);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const date = params.get("date") ?? getShanghaiDate();
  const model = (params.get("model") ?? "icon") as ForecastModel;
  const forceRefresh = params.get("refresh") === "1";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date 必须是 YYYY-MM-DD 格式" },
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
              "X-Cloudsea-Cache": "refresh-cooldown",
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
        "X-Cloudsea-Cache": "memory",
      },
    });
  }

  let activeTask = inFlight.get(key) ?? null;
  if (!activeTask) {
    activeTask = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const siteWeather = await fetchCloudSeaWeather(date, model, controller.signal);
        const weatherByDate = { [date]: siteWeather };
        return buildCloudSeaSnapshot(date, model, weatherByDate);
      } finally {
        clearTimeout(timeout);
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, activeTask);
  }

  try {
    const snapshot = await activeTask;
    rememberSnapshot(key, snapshot);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
        "X-Cloudsea-Cache": "fresh",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取云海气象数据失败";
    if (cached) {
      return NextResponse.json(
        { ...cached.snapshot, stale: true, refreshError: message },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-Cloudsea-Cache": "stale-on-error",
          },
        },
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
