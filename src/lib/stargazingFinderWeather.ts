import {
  addFinderDays,
  FINDER_LOCATIONS,
  getShanghaiDate,
} from "@/data/observingSites/catalog";
import {
  applyOpenMeteoApiKey,
  maxForecastDaysForModel,
  noteOpenMeteoRateLimit,
  OPEN_METEO_FORECAST_URL,
  OpenMeteoRateLimitError,
  openMeteoModelParameter,
  withOpenMeteoProviderSlot,
} from "./forecast";
import type {
  FinderHourlyData,
  FinderLocation,
  FinderWeatherRecord,
  FinderWeatherResponse,
} from "./stargazingFinderTypes";
import type { ForecastModel, ForecastProvenance } from "./types";

const BATCH_SIZE = 24;
const WORKERS = 2;
const CACHE_TTL_MS = 10 * 60 * 1000;
const HOURLY_VARIABLES = [
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
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
  relative_humidity_2m?: unknown;
  dew_point_2m?: unknown;
  precipitation_probability?: unknown;
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
  latitude?: unknown;
  longitude?: unknown;
  elevation?: unknown;
  timezone?: unknown;
  utc_offset_seconds?: unknown;
  hourly?: RawHourly;
}

const REQUIRED_SERIES = [
  ["relative_humidity_2m", "湿度"],
  ["dew_point_2m", "露点"],
  ["precipitation_probability", "降水概率"],
  ["weather_code", "天气代码"],
  ["cloud_cover", "总云"],
  ["cloud_cover_low", "低云"],
  ["cloud_cover_mid", "中云"],
  ["cloud_cover_high", "高云"],
  ["precipitation", "降水"],
  ["wind_speed_10m", "风速"],
  ["wind_gusts_10m", "阵风"],
  ["temperature_2m", "温度"],
] as const;

interface CacheEntry {
  savedAt: number;
  response: FinderWeatherResponse;
}

const responseCache = new Map<string, CacheEntry>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validNumericSeries(value: unknown, length: number): boolean {
  return Array.isArray(value) && value.length === length &&
    value.every((item) => item === null || (typeof item === "number" && Number.isFinite(item))) &&
    value.some((item) => typeof item === "number" && Number.isFinite(item));
}

function validTimeAxis(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((time) => typeof time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time)) &&
    new Set(value).size === value.length &&
    value.every((time, index) => index === 0 || time > value[index - 1]!);
}

export function validateFinderRawForecast(value: unknown): asserts value is RawForecast {
  if (!isRecord(value) || !isRecord(value.hourly)) {
    throw new Error("Open-Meteo 返回缺少 hourly 数据");
  }
  if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) ||
      Math.abs(Number(value.latitude)) > 90 || Math.abs(Number(value.longitude)) > 180 ||
      !Number.isFinite(value.elevation) || typeof value.timezone !== "string" ||
      !Number.isFinite(value.utc_offset_seconds)) {
    throw new Error("Open-Meteo 返回缺少地点坐标、海拔或时区身份");
  }
  const hourly = value.hourly as RawHourly;
  if (!validTimeAxis(hourly.time)) throw new Error("Open-Meteo 返回了无效或重复的时间轴");
  for (const [field, label] of REQUIRED_SERIES) {
    if (!validNumericSeries(hourly[field], hourly.time.length)) {
      throw new Error(`Open-Meteo 返回的${label}数组缺失或未与时间轴对齐`);
    }
  }
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

function distanceKm(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
): number {
  const radians = Math.PI / 180;
  const dLat = (latitudeB - latitudeA) * radians;
  const dLon = (longitudeB - longitudeA) * radians;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(latitudeA * radians) * Math.cos(latitudeB * radians) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371 * Math.asin(Math.sqrt(a));
}

interface BatchResult {
  hourlyByDate: Record<string, FinderHourlyData[]>;
  provenance: ForecastProvenance[];
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
    relative_humidity_2m: takeNumbers(hourly.relative_humidity_2m),
    dew_point_2m: takeNumbers(hourly.dew_point_2m),
    precipitation_probability: takeNumbers(hourly.precipitation_probability),
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
): Promise<BatchResult> {
  const url = buildFinderWeatherUrl(locations, dates, model);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await withOpenMeteoProviderSlot(() => fetch(url, {
        signal,
        headers: { Accept: "application/json" },
        cache: "no-store",
      }));
      if (!response.ok) {
        const body = await response.json().catch(() => null) as
          | { reason?: string }
          | null;
        lastError = new Error(
          body?.reason
            ? `Open-Meteo 返回 ${response.status}：${body.reason}`
            : `Open-Meteo 返回 ${response.status}`,
        );
        if (response.status === 429) {
          noteOpenMeteoRateLimit(response.headers.get("Retry-After"));
          break;
        }
        if (response.status < 500) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      const body: unknown = await response.json();
      const forecasts = Array.isArray(body) ? body : [body];
      if (forecasts.length !== locations.length) throw new Error("Open-Meteo 返回的地点数量与请求不匹配");
      forecasts.forEach(validateFinderRawForecast);
      if (forecasts.some((forecast, index) => distanceKm(
        locations[index]!.latitude,
        locations[index]!.longitude,
        Number(forecast.latitude),
        Number(forecast.longitude),
      ) > 50)) {
        throw new Error("Open-Meteo 返回地点与请求坐标映射不一致");
      }
      const expectedTimes = (forecasts[0]!.hourly!.time as string[]);
      if (forecasts.some((forecast) =>
        (forecast.hourly!.time as string[]).length !== expectedTimes.length ||
        (forecast.hourly!.time as string[]).some((time, index) => time !== expectedTimes[index]),
      )) {
        throw new Error("Open-Meteo 批量响应的时间轴不一致");
      }
      const sourceFetchedAt = new Date().toISOString();
      return {
        hourlyByDate: Object.fromEntries(
          dates.map((date) => [date, forecasts.map((forecast) => sliceHourly(forecast, date))]),
        ),
        provenance: forecasts.map((forecast, index) => ({
          requestedLatitude: locations[index]!.latitude,
          requestedLongitude: locations[index]!.longitude,
          modelLatitude: Number(forecast.latitude),
          modelLongitude: Number(forecast.longitude),
          modelDistanceKm: distanceKm(locations[index]!.latitude, locations[index]!.longitude, Number(forecast.latitude), Number(forecast.longitude)),
          modelElevation: Number(forecast.elevation),
          elevationSource: "provider-dem",
          sourceFetchedAt,
          providerRunAt: null,
          timezone: String(forecast.timezone),
          utcOffsetSeconds: Number(forecast.utc_offset_seconds),
        })),
      };
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
      if (error instanceof OpenMeteoRateLimitError) break;
    }
    if (lastError instanceof OpenMeteoRateLimitError) break;
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
        const batchResult = await requestBatch(
          batch,
          missingDates,
          signal,
          model,
        );
        const { hourlyByDate, provenance } = batchResult;
        const sourceFetchedAt = provenance[0]?.sourceFetchedAt;
        if (!sourceFetchedAt) throw new Error("Open-Meteo 未提供原始抓取时间");
        for (const date of missingDates) {
          const hourly = hourlyByDate[date] ?? [];
          batch.forEach((location, index) => {
            dataByDate[date][location.id] = {
              hourly: hourly[index] ?? null,
              status: hourly[index] ? "available" : "missing",
              fetchedAt: sourceFetchedAt,
              model,
              timezone: provenance[index]?.timezone,
              utcOffsetSeconds: provenance[index]?.utcOffsetSeconds,
              provenance: provenance[index],
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
    const sourceFetchedAt = Object.values(data)
      .map((record) => record.fetchedAt)
      .filter((value): value is string => typeof value === "string")
      .sort()[0];
    const response: FinderWeatherResponse = {
      date,
      fetchedAt,
      ...(sourceFetchedAt ? { sourceFetchedAt } : {}),
      model,
      providerRunAt: null,
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
