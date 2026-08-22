import {
  addFinderDays,
  FINDER_LOCATIONS,
  getShanghaiDate,
} from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import {
  applyOpenMeteoApiKey,
  maxForecastDaysForModel,
  OPEN_METEO_FORECAST_URL,
  openMeteoModelParameter,
} from "./forecast";
import type {
  FinderHourlyData,
  FinderLocation,
  FinderWeatherRecord,
  FinderWeatherResponse,
} from "./stargazingFinderTypes";
import type { ForecastModel } from "./types";

const BATCH_SIZE = 24;
const WORKERS = 4;
const CACHE_TTL_MS = 10 * 60 * 1000;
const HOURLY_VARIABLES = [
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "precipitation",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
  "temperature_2m",
].join(",");

interface RawHourly {
  time?: unknown;
  weather_code?: unknown;
  cloud_cover?: unknown;
  cloud_cover_low?: unknown;
  cloud_cover_mid?: unknown;
  cloud_cover_high?: unknown;
  precipitation?: unknown;
  visibility?: unknown;
  wind_speed_10m?: unknown;
  wind_gusts_10m?: unknown;
  temperature_2m?: unknown;
}

interface RawForecast {
  hourly?: RawHourly;
}

interface CacheEntry {
  savedAt: number;
  response: FinderWeatherResponse;
}

const responseCache = new Map<string, CacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRawForecast(value: unknown): value is RawForecast {
  return (
    isRecord(value) &&
    isRecord(value.hourly) &&
    Array.isArray(value.hourly.time)
  );
}

function numberArray(
  value: unknown,
  length: number,
): Array<number | null> {
  if (!Array.isArray(value)) return Array.from({ length }, () => null);
  return Array.from({ length }, (_, index) => {
    const item = value[index];
    return typeof item === "number" && Number.isFinite(item) ? item : null;
  });
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sliceHourly(raw: RawForecast, date: string): FinderHourlyData {
  const hourly = raw.hourly ?? {};
  const times = stringArray(hourly.time);
  const start = `${date}T07:00`;
  const end = `${addFinderDays(date, 1)}T15:00`;
  const indices = times
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time >= start && time <= end);
  if (indices.length === 0) {
    throw new Error(`Open-Meteo 未返回 ${date} 的逐小时数据`);
  }
  const takeNumbers = (value: unknown) => {
    const values = numberArray(value, times.length);
    return indices.map(({ index }) => values[index] ?? null);
  };
  return {
    time: indices.map(({ time }) => time),
    weather_code: takeNumbers(hourly.weather_code),
    cloud_cover: takeNumbers(hourly.cloud_cover),
    cloud_cover_low: takeNumbers(hourly.cloud_cover_low),
    cloud_cover_mid: takeNumbers(hourly.cloud_cover_mid),
    cloud_cover_high: takeNumbers(hourly.cloud_cover_high),
    precipitation: takeNumbers(hourly.precipitation),
    visibility: takeNumbers(hourly.visibility),
    wind_speed_10m: takeNumbers(hourly.wind_speed_10m),
    wind_gusts_10m: takeNumbers(hourly.wind_gusts_10m),
    temperature_2m: takeNumbers(hourly.temperature_2m),
  };
}

export function isFinderRangeAllowedForModel(
  dates: string[],
  model: ForecastModel,
  today = getShanghaiDate(),
): boolean {
  if (!dates.length || dates.some((date) => !isFinderDateAllowed(date, today))) {
    return false;
  }
  const lastNight = [...dates].sort().at(-1)!;
  // A night includes the following morning, so its end day must remain inside
  // the provider model's advertised forecast horizon.
  const requiredEndDate = addFinderDays(lastNight, 1);
  const latestAvailableDate = addFinderDays(
    today,
    maxForecastDaysForModel(model) - 1,
  );
  return requiredEndDate <= latestAvailableDate;
}

export function buildFinderWeatherUrl(
  locations: FinderLocation[],
  dates: string[],
  model: ForecastModel,
): string {
  if (!locations.length || !dates.length) {
    throw new Error("地点和日期不能为空");
  }
  const sortedDates = [...dates].sort();
  const params = new URLSearchParams({
    latitude: locations.map((location) => location.latitude).join(","),
    longitude: locations.map((location) => location.longitude).join(","),
    hourly: HOURLY_VARIABLES,
    timezone: "Asia/Shanghai",
    start_date: sortedDates[0],
    // Include the morning after the last observation night.
    end_date: addFinderDays(sortedDates.at(-1)!, 1),
    wind_speed_unit: "ms",
  });
  const providerModel = openMeteoModelParameter(model);
  if (providerModel) params.set("models", providerModel);
  applyOpenMeteoApiKey(params);
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

async function requestBatch(
  locations: FinderLocation[],
  dates: string[],
  signal: AbortSignal,
  model: ForecastModel,
): Promise<Record<string, FinderHourlyData[]>> {
  const url = buildFinderWeatherUrl(locations, dates, model);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as
          | { reason?: string }
          | null;
        lastError = new Error(
          body?.reason
            ? `Open-Meteo 返回 ${response.status}：${body.reason}`
            : `Open-Meteo 返回 ${response.status}`,
        );
        if (response.status < 500 && response.status !== 429) break;
        continue;
      }
      const body: unknown = await response.json();
      const forecasts = Array.isArray(body) ? body : [body];
      if (
        forecasts.length !== locations.length ||
        !forecasts.every(isRawForecast)
      ) {
        throw new Error(
          "Open-Meteo 返回的地点数量或 hourly 结构不匹配",
        );
      }
      return Object.fromEntries(
        dates.map((date) => [
          date,
          forecasts.map((forecast) => sliceHourly(forecast, date)),
        ]),
      );
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Open-Meteo 请求失败");
}

function staleResponse(
  response: FinderWeatherResponse,
): FinderWeatherResponse {
  const data: Record<string, FinderWeatherRecord> = {};
  for (const [id, record] of Object.entries(response.data)) {
    data[id] = record.hourly
      ? { ...record, status: "stale" }
      : { ...record, status: "error" };
  }
  return { ...response, stale: true, data };
}

export function isFinderDateAllowed(
  date: string,
  today = getShanghaiDate(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const target = Date.parse(`${date}T12:00:00Z`);
  const lower = Date.parse(`${addFinderDays(today, -1)}T12:00:00Z`);
  const upper = Date.parse(`${addFinderDays(today, 14)}T12:00:00Z`);
  return Number.isFinite(target) && target >= lower && target <= upper;
}

export async function fetchFinderWeather(
  date: string,
  signal: AbortSignal,
  forceRefresh = false,
  model: ForecastModel = "best_match",
): Promise<FinderWeatherResponse> {
  return (
    await fetchFinderWeatherRange([date], signal, forceRefresh, model)
  )[date] as FinderWeatherResponse;
}

/**
 * Fetch a group of observing nights in one upstream request per coordinate
 * batch. `start_date/end_date` are used instead of `forecast_days`, so a
 * future selected night cannot accidentally request only the first seven days.
 */
export async function fetchFinderWeatherRange(
  dates: string[],
  signal: AbortSignal,
  forceRefresh = false,
  model: ForecastModel = "best_match",
): Promise<Record<string, FinderWeatherResponse>> {
  const uniqueDates = [...new Set(dates)].sort();
  if (!isFinderRangeAllowedForModel(uniqueDates, model)) {
    throw new Error(
      `${model.toUpperCase()} 预报范围不足以覆盖所选夜晚；请缩短范围或切换 GFS / Best Match`,
    );
  }

  const responses: Record<string, FinderWeatherResponse> = {};
  const missingDates: string[] = [];
  for (const date of uniqueDates) {
    const cached = responseCache.get(`${model}|${date}`);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.savedAt < CACHE_TTL_MS
    ) {
      responses[date] = cached.response;
    } else {
      missingDates.push(date);
    }
  }
  if (missingDates.length === 0) return responses;

  const dataByDate: Record<
    string,
    Record<string, FinderWeatherRecord>
  > = Object.fromEntries(
    missingDates.map((date) => [
      date,
      Object.fromEntries(
        FINDER_LOCATIONS.map((location) => [
          location.id,
          { hourly: null, status: "missing" as const },
        ]),
      ),
    ]),
  );
  const batches: FinderLocation[][] = [];
  for (
    let index = 0;
    index < FINDER_LOCATIONS.length;
    index += BATCH_SIZE
  ) {
    batches.push(FINDER_LOCATIONS.slice(index, index + BATCH_SIZE));
  }
  let cursor = 0;
  const worker = async () => {
    while (cursor < batches.length) {
      const batchIndex = cursor;
      cursor += 1;
      const batch = batches[batchIndex];
      if (!batch) continue;
      try {
        const hourlyByDate = await requestBatch(
          batch,
          missingDates,
          signal,
          model,
        );
        for (const date of missingDates) {
          const hourly = hourlyByDate[date] ?? [];
          batch.forEach((location, index) => {
            dataByDate[date][location.id] = {
              hourly: hourly[index] ?? null,
              status: hourly[index] ? "available" : "missing",
            };
          });
        }
      } catch (error) {
        if (signal.aborted) throw error;
        const message =
          error instanceof Error ? error.message : "天气请求失败";
        for (const date of missingDates) {
          batch.forEach((location) => {
            dataByDate[date][location.id] = {
              hourly: null,
              status: "error",
              error: message,
            };
          });
        }
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(WORKERS, batches.length) }, () => worker()),
  );

  const fetchedAt = new Date().toISOString();
  for (const date of missingDates) {
    const data = dataByDate[date];
    const response: FinderWeatherResponse = {
      date,
      fetchedAt,
      source: `Open-Meteo Forecast API · ${model}`,
      stale: Object.values(data).some(
        (record) => record.status === "error",
      ),
      data,
    };
    const cacheKey = `${model}|${date}`;
    const cached = responseCache.get(cacheKey);
    if (
      Object.values(data).some((record) => record.status === "available")
    ) {
      responseCache.set(cacheKey, { savedAt: Date.now(), response });
      responses[date] = response;
    } else if (cached) {
      responses[date] = staleResponse(cached.response);
    } else {
      responses[date] = response;
    }
  }
  return responses;
}
