import { OpenMeteoRateLimitError, withOpenMeteoProviderSlot, noteOpenMeteoRateLimit, currentOpenMeteoRateLimit } from "./forecast";
import { hasUsablePressureProfile } from "./pressureIntegrity";
export { pressureProfileAt, hasUsablePressureProfile, isCompletePressureLevelSample, usablePressureLevelCount } from "./pressureIntegrity";
import {
  applyOpenMeteoApiKey,
  buildForecastUrl,
  clampForecastDays,
  OPEN_METEO_FORECAST_URL,
  openMeteoModelParameter,
} from "./forecast";
import { normalizeEpochHours } from "./absoluteForecastTime";
import { validateProviderHourlyFields } from "./providerWeatherIntegrity";
import { validProductDate } from "./productRoutes";
import { PRESSURE_LEVELS } from "./pressureLevels";
import type { ForecastModel } from "./types";
import type { RawSiteHourly } from "./cloudsea";

export { PRESSURE_LEVELS } from "./pressureLevels";

export interface PressureLevelSample {
  pressure: number;
  cloudCover: number | null;
  humidity: number | null;
  temperature: number | null;
  heightMsl: number | null;
}

export interface PressureForecastResponse {
  locationId: string;
  requestedLatitude?: number;
  requestedLongitude?: number;
  modelLatitude?: number | null;
  modelLongitude?: number | null;
  /** Legacy API elevation; may be a downscaling DEM, not model terrain. */
  modelElevation: number;
  /** Request-attested native model terrain; raw API elevation alone is a DEM/downscaling height. */
  nativeGridElevationM?: number;
  verticalReference?: "native-grid-v2";
  providerModel?: string;
  /** Native levels admitted by the current archived-data qualification. */
  qualifiedPressureLevels?: readonly number[];
  timezone: string;
  utcOffsetSeconds: number;
  fetchedAt: string;
  source: "Open-Meteo";
  model: ForecastModel;
  stale?: boolean;
  timeAxisVersion?: "epoch-v1";
  profilesByEpoch?: Record<string, PressureLevelSample[]>;
  hourly: Array<{ time: string; epochSeconds?: number; utcOffsetSeconds?: number; temperature: number | null }>;
  profiles: Record<string, PressureLevelSample[]>;
}

export interface PressureForecastLocation {
  id: string;
  latitude: number;
  longitude: number;
}

export interface PressureForecastBatchResult {
  data: Record<string, PressureForecastResponse>;
  errors: Record<string, string>;
  surface?: Record<string, RawSiteHourly>;
  surfaceErrors?: Record<string, string>;
}

const CLOUD_SEA_SURFACE_FIELDS = ["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "relative_humidity_2m", "wind_speed_10m", "precipitation"] as const;

const MIN_USABLE_PRESSURE_LEVELS = 6;
const PRESSURE_REQUEST_TIMEOUT_MS = 12_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pressureVariables(): string[] {
  return PRESSURE_LEVELS.flatMap((level) => [
    `cloud_cover_${level}hPa`,
    `relative_humidity_${level}hPa`,
    `temperature_${level}hPa`,
    `geopotential_height_${level}hPa`,
  ]);
}

function withPressureVariables(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("timeformat", "unixtime");
  const current = parsed.searchParams.get("hourly");
  parsed.searchParams.set(
    "hourly",
    [current, ...pressureVariables()].filter(Boolean).join(","),
  );
  return parsed.toString();
}

function validatePressureLocations(locations: PressureForecastLocation[]): void {
  if (!locations.length) {
    throw new Error("气压批量请求至少需要一个地点");
  }
  const ids = new Set<string>();
  for (const location of locations) {
    if (!location.id || ids.has(location.id)) {
      throw new Error("气压批量请求的地点 id 必须非空且唯一");
    }
    ids.add(location.id);
    if (
      !Number.isFinite(location.latitude) ||
      !Number.isFinite(location.longitude) ||
      location.latitude < -90 ||
      location.latitude > 90 ||
      location.longitude < -180 ||
      location.longitude > 180
    ) {
      throw new Error(`气压批量请求包含无效坐标：${location.id}`);
    }
  }
}

export function buildPressureForecastBatchUrl(
  locations: PressureForecastLocation[],
  date: string,
  model: ForecastModel,
  cloudSea = false,
): string {
  validatePressureLocations(locations);
  if (!validProductDate(date)) {
    throw new Error("气压批量请求日期必须是 YYYY-MM-DD");
  }
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    hourly: ["temperature_2m", ...pressureVariables()].join(","),
    timezone: "Asia/Shanghai",
    timeformat: "unixtime",
    start_date: date,
    end_date: date,
  });
  if (cloudSea) {
    params.set("cell_selection", "nearest");
    params.set("elevation", locations.map(() => "nan").join(","));
    params.set("hourly", ["temperature_2m", ...CLOUD_SEA_SURFACE_FIELDS, ...pressureVariables()].join(","));
    params.set("wind_speed_unit", "ms");
  }
  const providerModel = cloudSea && model === "gfs" ? "ncep_gfs025" : cloudSea && model === "icon" ? "icon_global" : openMeteoModelParameter(model);
  if (providerModel) params.set("models", providerModel);
  applyOpenMeteoApiKey(params);
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

async function providerError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as
    | { reason?: string }
    | null;
  if (response.status === 429) return noteOpenMeteoRateLimit(response.headers.get("Retry-After"), body?.reason ?? "");
  return new Error(
    body?.reason
      ? `气压接口返回 ${response.status}：${body.reason}`
      : `气压接口返回 ${response.status}`,
  );
}

function waitForPressureRetry(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new DOMException("The operation was aborted", "AbortError"),
    );
  }
  return new Promise((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new DOMException("The operation was aborted", "AbortError"),
      );
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

function pressureRequestSignal(parent?: AbortSignal): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  const timeout = setTimeout(
    () =>
      controller.abort(
        new DOMException("气压接口单次请求超时", "TimeoutError"),
      ),
    PRESSURE_REQUEST_TIMEOUT_MS,
  );
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abortFromParent);
    },
  };
}

async function requestPressureJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const request = pressureRequestSignal(signal);
    try {
      const response = await withOpenMeteoProviderSlot(() => fetch(url, {
        signal: request.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      }));
      if (response.ok) return await response.json();
      lastError = await providerError(response);
      if (lastError instanceof OpenMeteoRateLimitError) break;
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
      if (error instanceof OpenMeteoRateLimitError || currentOpenMeteoRateLimit()) break;
    } finally {
      request.cleanup();
    }
    if (attempt === 0) await waitForPressureRetry(300, signal);
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("气压接口请求失败");
}

function isAlignedNumericSeries(value: unknown, length: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every(
      (item) =>
        item === null || (typeof item === "number" && Number.isFinite(item)),
    )
  );
}

function valueAt(
  hourly: Record<string, unknown>,
  key: string,
  index: number,
): unknown {
  const values = hourly[key];
  return Array.isArray(values) ? values[index] : undefined;
}

function validTimeAxis(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 &&
    value.every((time) => typeof time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time) && validProductDate(time.slice(0, 10)) && Number(time.slice(11, 13)) < 24 && Number(time.slice(14, 16)) < 60 && (time.length === 16 || Number(time.slice(17, 19)) < 60)) &&
    new Set(value).size === value.length &&
    value.every((time, index) => index === 0 || time > value[index - 1]!);
}

/**
 * Parse one Open-Meteo pressure response. A pressure level only counts toward
 * the schema reliability threshold when cloud cover, RH, temperature and
 * geopotential height are all aligned to the same hourly time axis. Individual
 * hours are checked separately by hasUsablePressureProfile().
 */
export function parsePressureForecast(
  raw: unknown,
  locationId: string,
  model: ForecastModel,
  nativeGrid = false,
): PressureForecastResponse {
  if (!isRecord(raw) || !isRecord(raw.hourly)) {
    throw new Error("气压上游返回了无法识别的 hourly 数据");
  }
  const hourly = raw.hourly;
  const rawTimes = hourly.time;
  const absolute = Array.isArray(rawTimes) && rawTimes.length > 0 && rawTimes.every(time => typeof time === "number");
  let clocks: Array<{ time: string; epochSeconds?: number; utcOffsetSeconds?: number }>;
  if (absolute) {
    if (typeof raw.timezone !== "string" || !raw.timezone) throw new Error("气压上游缺少时区身份");
    clocks = normalizeEpochHours(rawTimes as number[], raw.timezone);
  } else {
    if (!validTimeAxis(rawTimes)) throw new Error("气压上游返回了无效逐小时时间轴");
    clocks = rawTimes.map(time => ({ time }));
  }
  const modelElevation = numberOrNull(raw.elevation);
  if (modelElevation === null || modelElevation < -500 || modelElevation > 10000) {
    throw new Error("气压上游 elevation 来源高度缺失或超出地表范围");
  }

  const times = clocks.map(clock => clock.time);
  const availableLevels = PRESSURE_LEVELS.filter((level) =>
    [
      `cloud_cover_${level}hPa`,
      `relative_humidity_${level}hPa`,
      `temperature_${level}hPa`,
      `geopotential_height_${level}hPa`,
    ].every((key) => isAlignedNumericSeries(hourly[key], times.length)),
  );
  if (availableLevels.length < MIN_USABLE_PRESSURE_LEVELS) {
    throw new Error(
      `气压上游仅返回 ${availableLevels.length} 个完整可用层，无法形成可靠剖面`,
    );
  }
  // GFS025 may return unsupported 2m temperature as all-null with unit
  // "undefined". It is optional chart context, not pressure-profile evidence.
  const usedFields = Object.fromEntries(Object.entries(hourly).filter(([key, values]) =>
    key === "time" || (key === "temperature_2m" && (!Array.isArray(values) || values.some(value => value !== null))) || availableLevels.some(level => key.endsWith(`_${level}hPa`)),
  ));
  validateProviderHourlyFields(usedFields, raw.hourly_units);

  const profiles: PressureForecastResponse["profiles"] = {};
  const profilesByEpoch: Record<string, PressureLevelSample[]> = {};
  times.forEach((time, index) => {
    const profile = PRESSURE_LEVELS.map((pressure) => ({
      pressure,
      cloudCover: numberOrNull(
        valueAt(usedFields, `cloud_cover_${pressure}hPa`, index),
      ),
      humidity: numberOrNull(
        valueAt(usedFields, `relative_humidity_${pressure}hPa`, index),
      ),
      temperature: numberOrNull(
        valueAt(usedFields, `temperature_${pressure}hPa`, index),
      ),
      heightMsl: numberOrNull(
        valueAt(usedFields, `geopotential_height_${pressure}hPa`, index),
      ),
    }));
    // Legacy wall-clock lookup deterministically chooses the earlier occurrence.
    if (!profiles[time]) profiles[time] = profile;
    if (absolute) profilesByEpoch[String(clocks[index].epochSeconds)] = profile;
  });

  if (!Object.values(profilesByEpoch).concat(Object.values(profiles)).some((profile) => hasUsablePressureProfile(profile))) {
    throw new Error("气压上游没有任何小时具备至少 6 个完整压力层");
  }

  return {
    locationId,
    modelElevation,
    ...(nativeGrid ? { nativeGridElevationM: modelElevation, verticalReference: "native-grid-v2" as const,
      qualifiedPressureLevels: model === "gfs" ? PRESSURE_LEVELS : [1000,975,950,925,900,850,800,700,600,500] } : {}),
    modelLatitude: numberOrNull(raw.latitude),
    modelLongitude: numberOrNull(raw.longitude),
    timezone: typeof raw.timezone === "string" ? raw.timezone : "Asia/Shanghai",
    utcOffsetSeconds: numberOrNull(raw.utc_offset_seconds) ?? 0,
    fetchedAt: new Date().toISOString(),
    source: "Open-Meteo",
    model,
    stale: !absolute,
    ...(absolute ? { timeAxisVersion: "epoch-v1" as const, profilesByEpoch } : {}),
    hourly: clocks.map((clock, index) => ({
      ...clock,
      temperature: numberOrNull(valueAt(hourly, "temperature_2m", index)),
    })),
    profiles,
  };
}

/** Fixed-date CloudSea batches require the identity requested from Open-Meteo.
 * Returned grid coordinates may legitimately differ from the input location,
 * but a missing/out-of-range grid position is never trustworthy.
 */
function assertShanghaiPressureBatchIdentity(value: unknown): void {
  if (!isRecord(value) || value.timezone !== "Asia/Shanghai" || value.utc_offset_seconds !== 28800) {
    throw new Error("气压批量响应时区与 Asia/Shanghai（UTC+08:00）请求不一致");
  }
  const latitude = value.latitude;
  const longitude = value.longitude;
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) {
    throw new Error("气压批量响应缺少有效模式网格坐标");
  }
}

function cloudSeaSurface(entry: unknown, date: string, providerModel: string): RawSiteHourly {
  assertShanghaiPressureBatchIdentity(entry);
  if (!isRecord(entry) || !isRecord(entry.hourly)) throw new Error("云海来源缺少地面字段");
  const hourly = entry.hourly;
  if (!Array.isArray(hourly.time) || hourly.time.length === 0 || !hourly.time.every(time => typeof time === "number" && Number.isFinite(time))) throw new Error("云海来源缺少绝对时间轴");
  const used = Object.fromEntries(["time", ...CLOUD_SEA_SURFACE_FIELDS].map(field => [field, hourly[field]]));
  validateProviderHourlyFields(used, entry.hourly_units);
  const time = normalizeEpochHours(hourly.time, "Asia/Shanghai").map(clock => clock.time);
  if (time.some(hour => !hour.startsWith(`${date}T`))) throw new Error("云海来源与目标日期不一致");
  if (!CLOUD_SEA_SURFACE_FIELDS.every(field => isAlignedNumericSeries(hourly[field], time.length))) throw new Error("云海地面字段长度不一致");
  return { ...Object.fromEntries(CLOUD_SEA_SURFACE_FIELDS.map(field => [field, hourly[field]])), time, sourceFetchedAt: new Date().toISOString(),
    ...(Number.isFinite(entry.elevation) ? { sourceGrid: { providerModel, latitude: Number(entry.latitude), longitude: Number(entry.longitude), elevation: Number(entry.elevation) } } : {}) } as RawSiteHourly;
}

/**
 * Fetch one Open-Meteo multi-coordinate pressure request. The caller may pass
 * a bounded chunk of sites; malformed profiles are isolated per site, while a
 * coordinate-count mismatch fails the whole batch to prevent silent reordering.
 */
export async function fetchPressureForecastBatch(
  locations: PressureForecastLocation[],
  date: string,
  signal?: AbortSignal,
  model: ForecastModel = "best_match",
  cloudSea = false,
): Promise<PressureForecastBatchResult> {
  const url = buildPressureForecastBatchUrl(locations, date, model, cloudSea);
  const raw = await requestPressureJson(url, signal);
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length !== locations.length) {
    throw new Error(
      `气压上游返回 ${list.length} 个地点，与请求的 ${locations.length} 个地点不匹配`,
    );
  }

  const data: Record<string, PressureForecastResponse> = {};
  const errors: Record<string, string> = {};
  const surface: Record<string, RawSiteHourly> = {};
  const surfaceErrors: Record<string, string> = {};
  locations.forEach((location, index) => {
    try {
      const entry = list[index];
      assertShanghaiPressureBatchIdentity(entry);
      if (cloudSea) {
        try { surface[location.id] = cloudSeaSurface(entry, date, new URL(url).searchParams.get("models") ?? "best_match"); }
        catch (error) { surfaceErrors[location.id] = error instanceof Error ? error.message : "地面字段不可用"; }
      }
      // Seamless/best-match can combine grids per variable. Native elevation is
      // only pressure terrain for an explicitly selected single model domain.
      const singleGrid = cloudSea && (model === "gfs" || model === "icon");
      const parsed = parsePressureForecast(entry, location.id, model, singleGrid);
      // An epoch-v1 source must belong to the requested local calendar day.
      // Legacy wall-clock profiles remain stale facts, never fresh evidence.
      if (parsed.timeAxisVersion === "epoch-v1" && parsed.hourly.some(hour => !hour.time.startsWith(`${date}T`))) {
        throw new Error("气压绝对时间轴与目标日期不一致");
      }
      data[location.id] = { ...parsed, providerModel: new URL(url).searchParams.get("models") ?? "best_match", requestedLatitude: location.latitude, requestedLongitude: location.longitude };
    } catch (error) {
      errors[location.id] =
        error instanceof Error ? error.message : "气压剖面解析失败";
    }
  });

  // Open-Meteo stores GFS025 pressure and GFS013 surface fields separately.
  // Never reuse the surface grid's elevation to mask a pressure grid. Record
  // both domains and replace the whole surface bundle, not individual fields.
  if (cloudSea && model === "gfs") {
    const pending = locations.filter(location => !CLOUD_SEA_SURFACE_FIELDS.every(field => surface[location.id]?.[field]?.some(value => typeof value === "number" && Number.isFinite(value))));
    if (pending.length) {
      const surfaceUrl = new URL(url);
      surfaceUrl.searchParams.set("latitude", pending.map(location => location.latitude).join(","));
      surfaceUrl.searchParams.set("longitude", pending.map(location => location.longitude).join(","));
      surfaceUrl.searchParams.set("elevation", pending.map(() => "nan").join(","));
      surfaceUrl.searchParams.set("models", "ncep_gfs013");
      surfaceUrl.searchParams.set("hourly", CLOUD_SEA_SURFACE_FIELDS.join(","));
      try {
        const rawSurface = await requestPressureJson(surfaceUrl.toString(), signal);
        const entries = Array.isArray(rawSurface) ? rawSurface : [rawSurface];
        if (entries.length !== pending.length) throw new Error("GFS 地面来源地点数量不一致");
        pending.forEach((location, index) => {
          try { surface[location.id] = cloudSeaSurface(entries[index], date, "ncep_gfs013"); delete surfaceErrors[location.id]; }
          catch (error) { surfaceErrors[location.id] = error instanceof Error ? error.message : "地面补取不可用"; }
        });
      } catch (error) {
        pending.forEach(location => { surfaceErrors[location.id] = error instanceof Error ? error.message : "地面来源补取失败"; });
      }
    }
  }

  if (Object.keys(data).length === 0 && Object.keys(surface).length === 0) {
    throw new Error(Object.values(errors)[0] ?? "气压剖面不可用");
  }
  return { data, errors, ...(cloudSea ? { surface, surfaceErrors } : {}) };
}

export async function fetchPressureForecast(
  latitude: number,
  longitude: number,
  days = 7,
  signal?: AbortSignal,
  model: ForecastModel = "best_match",
): Promise<PressureForecastResponse> {
  const url = withPressureVariables(
    buildForecastUrl(
      [
        {
          id: "pressure",
          name: "",
          latitude,
          longitude,
          elevation: 0,
          source: "搜索",
        },
      ],
      clampForecastDays(days, model),
      model,
    ),
  );
  const raw = await requestPressureJson(url, signal);
  const entry = Array.isArray(raw) ? raw[0] : raw;
  if (entry === undefined) {
    throw new Error("气压上游没有返回地点数据");
  }
  return { ...parsePressureForecast(entry, "pressure", model), requestedLatitude: latitude, requestedLongitude: longitude };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

