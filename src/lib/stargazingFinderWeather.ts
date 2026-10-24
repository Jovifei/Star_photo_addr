import fs from "node:fs";
import { validateProviderHourlyFields } from "./providerWeatherIntegrity";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { dataAgeMs } from "./forecastIntegrity";
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
  hourly_units?: Record<string, unknown>;
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
      !Number.isFinite(value.elevation) || value.timezone !== "Asia/Shanghai" ||
      value.utc_offset_seconds !== 28800) {
    throw new Error("Open-Meteo 返回缺少地点坐标、海拔或时区身份");
  }
  const hourly = value.hourly as RawHourly;
  if (!validTimeAxis(hourly.time)) throw new Error("Open-Meteo 返回了无效或重复的时间轴");
  for (const [field, label] of REQUIRED_SERIES) {
    if (!validNumericSeries(hourly[field], hourly.time.length)) {
      throw new Error(`Open-Meteo 返回的${label}数组缺失或未与时间轴对齐`);
    }
  }
  validateProviderHourlyFields(hourly as Record<string, unknown>, value.hourly_units);
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
  stale: boolean;
  hourlyByDate: Record<string, FinderHourlyData[]>;
  provenance: ForecastProvenance[];
}

export type FinderForecastWindow = "observing-night" | "calendar-day";

function sliceHourly(
  raw: RawForecast,
  date: string,
  window: FinderForecastWindow = "observing-night",
): FinderHourlyData {
  const hourly = raw.hourly ?? {};
  const times = stringArray(hourly.time);
  const start = `${date}T${window === "calendar-day" ? "00:00" : "07:00"}`;
  const end = window === "calendar-day"
    ? `${date}T23:00`
    : `${addFinderDays(date, 1)}T15:00`;
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
  window: FinderForecastWindow = "observing-night",
): boolean {
  if (!dates.length || dates.some((date) => !isFinderDateAllowed(date, today))) {
    return false;
  }
  const lastDate = [...dates].sort().at(-1)!;
  // Finder's selected night includes the following morning; FireGlow consumes
  // one calendar day. Validate the actual end of each product's time window.
  const requiredEndDate = window === "calendar-day"
    ? lastDate
    : addFinderDays(lastDate, 1);
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
  window: FinderForecastWindow = "observing-night",
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
    // Finder needs the following morning; FireGlow scores the requested local
    // calendar day and must not spend a forecast day on an unrelated morning.
    end_date: window === "calendar-day"
      ? sortedDates.at(-1)!
      : addFinderDays(sortedDates.at(-1)!, 1),
    wind_speed_unit: "ms",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });
  const providerModel = openMeteoModelParameter(model);
  if (providerModel) params.set("models", providerModel);
  applyOpenMeteoApiKey(params);
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

const RAW_TTL_MS = 3 * 60 * 60_000;
interface RawBatchCache { fetchedAt: string; forecasts: RawForecast[]; stale?: boolean; }
const rawBatchCache = new Map<string, RawBatchCache>();
const rawBatchInFlight = new Map<string, Promise<RawBatchCache>>();
const rawCacheDirectory = path.join(process.env.OBSERVING_SNAPSHOT_DIR || os.tmpdir(), "finder-raw-cache-v1");

function validRawCache(
  value: unknown,
  locations: FinderLocation[],
  dates: string[],
  window: FinderForecastWindow = "observing-night",
  maxAgeMs = RAW_TTL_MS,
): value is RawBatchCache {
  try {
    const candidate = value as RawBatchCache;
    if (!candidate || dataAgeMs(candidate.fetchedAt) >= maxAgeMs || !Array.isArray(candidate.forecasts) || candidate.forecasts.length !== locations.length) return false;
    candidate.forecasts.forEach((forecast, index) => {
      validateFinderRawForecast(forecast);
      if (distanceKm(locations[index]!.latitude, locations[index]!.longitude, Number(forecast.latitude), Number(forecast.longitude)) > 50) throw new Error("coordinate mismatch");
      dates.forEach((date) => sliceHourly(forecast, date, window));
    });
    return true;
  } catch { return false; }
}

async function cachedRawBatch(
  url: string,
  locations: FinderLocation[],
  dates: string[],
  window: FinderForecastWindow,
): Promise<RawBatchCache> {
  const key = createHash("sha256").update(url).digest("hex");
  const memory = rawBatchCache.get(key);
  if (validRawCache(memory, locations, dates, window)) return memory;
  let fallback: RawBatchCache | null = validRawCache(memory, locations, dates, window, 6 * 60 * 60_000) ? memory : null;
  const diskEnabled = process.env.NODE_ENV !== "test" || process.env.FINDER_ENABLE_DISK_CACHE === "1";
  if (diskEnabled) {
    try {
      const disk: unknown = JSON.parse(fs.readFileSync(path.join(rawCacheDirectory, `${key}.json`), "utf8"));
      if (validRawCache(disk, locations, dates, window)) { rawBatchCache.set(key, disk); return disk; }
      if (validRawCache(disk, locations, dates, window, 6 * 60 * 60_000)) fallback = disk;
    } catch { /* Optional persistence never supplies invalid data. */ }
  }
  const existing = rawBatchInFlight.get(key);
  if (existing) return existing;
  const task = (async () => {
    // Shared requests must survive cancellation of their first consumer.
    const sharedSignal = AbortSignal.timeout(25_000);
    const response = await withOpenMeteoProviderSlot(() => fetch(url, { signal: sharedSignal, headers: { Accept: "application/json" }, cache: "no-store" }));
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { reason?: string } | null;
      if (response.status === 429) throw noteOpenMeteoRateLimit(response.headers.get("Retry-After"), body?.reason ?? "");
      throw new Error(`Open-Meteo 返回 ${response.status}：${body?.reason ?? "天气请求失败"}`);
    }
    const body: unknown = await response.json();
    const entry = { forecasts: Array.isArray(body) ? body : [body], fetchedAt: new Date().toISOString() } as RawBatchCache;
    // A provider may truncate the requested horizon. Such responses are still
    // validated by the caller for its requested dates, but never persisted.
    if (validRawCache(entry, locations, dates, window)) {
      rawBatchCache.set(key, entry);
      while (rawBatchCache.size > 128) rawBatchCache.delete(rawBatchCache.keys().next().value!);
      if (diskEnabled) {
        try {
          fs.mkdirSync(rawCacheDirectory, { recursive: true });
          const target = path.join(rawCacheDirectory, `${key}.json`);
          const temporary = `${target}.${process.pid}.${Date.now()}.tmp`;
          fs.writeFileSync(temporary, JSON.stringify(entry));
          fs.renameSync(temporary, target);
        } catch { /* Optional cache write failure does not change provenance. */ }
      }
    }
    return entry;
  })().catch((error: unknown) => {
    if (fallback && validRawCache(fallback, locations, dates, window, 6 * 60 * 60_000)) {
      return { ...fallback, stale: true };
    }
    throw error;
  });
  rawBatchInFlight.set(key, task);
  try { return await task; } finally { if (rawBatchInFlight.get(key) === task) rawBatchInFlight.delete(key); }
}

async function requestBatch(
  locations: FinderLocation[],
  dates: string[],
  signal: AbortSignal,
  model: ForecastModel,
  window: FinderForecastWindow,
): Promise<BatchResult> {
  const today = getShanghaiDate();
  const start = [...dates, today].sort()[0]!;
  const horizonNight = addFinderDays(today, maxForecastDaysForModel(model) - 2);
  const standardEnd = [addFinderDays(today, 3), horizonNight].sort()[0]!;
  const end = [...dates, standardEnd].sort().at(-1)!;
  const coverageDates: string[] = [];
  for (let date = start; date <= end; date = addFinderDays(date, 1)) coverageDates.push(date);
  const url = buildFinderWeatherUrl(locations, coverageDates, model, window);
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const raw = await cachedRawBatch(url, locations, coverageDates, window);
      const forecasts = raw.forecasts;
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
      const sourceFetchedAt = raw.fetchedAt;
      return {
        stale: raw.stale === true,
        hourlyByDate: Object.fromEntries(
          dates.map((date) => [date, forecasts.map((forecast) => sliceHourly(forecast, date, window))]),
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

export async function fetchFireGlowWeather(
  date: string,
  signal: AbortSignal,
  forceRefresh = false,
  model: ForecastModel = "best_match",
): Promise<FinderWeatherResponse> {
  return (
    await fetchFinderWeatherRange([date], signal, forceRefresh, model, "calendar-day")
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
  window: FinderForecastWindow = "observing-night",
): Promise<Record<string, FinderWeatherResponse>> {
  const uniqueDates = [...new Set(dates)].sort();
  if (!isFinderRangeAllowedForModel(uniqueDates, model, getShanghaiDate(), window)) {
    const selectedPeriod = window === "calendar-day" ? "所选日期" : "所选夜晚";
    throw new Error(
      `${model.toUpperCase()} 预报范围不足以覆盖${selectedPeriod}；请缩短范围或切换 GFS / Best Match`,
    );
  }

  const responses: Record<string, FinderWeatherResponse> = {};
  const missingDates: string[] = [];
  for (const date of uniqueDates) {
    const cached = responseCache.get(`${model}|${window}|${date}`);
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
          window,
        );
        const { hourlyByDate, provenance } = batchResult;
        const sourceFetchedAt = provenance[0]?.sourceFetchedAt;
        if (!sourceFetchedAt) throw new Error("Open-Meteo 未提供原始抓取时间");
        for (const date of missingDates) {
          const hourly = hourlyByDate[date] ?? [];
          batch.forEach((location, index) => {
            dataByDate[date][location.id] = {
              hourly: hourly[index] ?? null,
              status: hourly[index] ? batchResult.stale ? "stale" : "available" : "missing",
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
        (record) => record.status === "error" || record.status === "stale",
      ),
      data,
    };
    const cacheKey = `${model}|${window}|${date}`;
    const cached = responseCache.get(cacheKey);
    if (
      Object.values(data).some((record) => record.status === "available")
    ) {
      responseCache.set(cacheKey, { savedAt: Date.now(), response });
      responses[date] = response;
    } else if (cached && dataAgeMs(cached.response.sourceFetchedAt ?? cached.response.fetchedAt) < 6 * 60 * 60_000) {
      responses[date] = staleResponse(cached.response);
    } else {
      responses[date] = response;
    }
  }
  return responses;
}
