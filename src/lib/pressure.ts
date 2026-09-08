import {
  applyOpenMeteoApiKey,
  buildForecastUrl,
  clampForecastDays,
  OPEN_METEO_FORECAST_URL,
  openMeteoModelParameter,
} from "./forecast";
import { PRESSURE_LEVELS } from "./pressureLevels";
import type { ForecastModel } from "./types";

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
  modelElevation: number;
  timezone: string;
  utcOffsetSeconds: number;
  fetchedAt: string;
  source: "Open-Meteo";
  model: ForecastModel;
  stale?: boolean;
  hourly: Array<{ time: string; temperature: number | null }>;
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
}

const MIN_USABLE_PRESSURE_LEVELS = 6;

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
): string {
  validatePressureLocations(locations);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("气压批量请求日期必须是 YYYY-MM-DD");
  }
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    hourly: ["temperature_2m", ...pressureVariables()].join(","),
    timezone: "Asia/Shanghai",
    start_date: date,
    end_date: date,
  });
  const providerModel = openMeteoModelParameter(model);
  if (providerModel) params.set("models", providerModel);
  applyOpenMeteoApiKey(params);
  return `${OPEN_METEO_FORECAST_URL}?${params.toString()}`;
}

async function providerError(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as
    | { reason?: string }
    | null;
  return new Error(
    body?.reason
      ? `气压接口返回 ${response.status}：${body.reason}`
      : `气压接口返回 ${response.status}`,
  );
}

async function requestPressureJson(
  url: string,
  signal?: AbortSignal,
): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) return await response.json();
      lastError = await providerError(response);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
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

export function isCompletePressureLevelSample(
  sample: PressureLevelSample,
): boolean {
  return (
    Number.isFinite(sample.pressure) &&
    sample.cloudCover !== null &&
    Number.isFinite(sample.cloudCover) &&
    sample.humidity !== null &&
    Number.isFinite(sample.humidity) &&
    sample.temperature !== null &&
    Number.isFinite(sample.temperature) &&
    sample.heightMsl !== null &&
    Number.isFinite(sample.heightMsl)
  );
}

export function usablePressureLevelCount(
  samples: PressureLevelSample[] | null | undefined,
): number {
  if (!samples) return 0;
  return samples.filter(isCompletePressureLevelSample).length;
}

export function hasUsablePressureProfile(
  samples: PressureLevelSample[] | null | undefined,
  minimumLevels = MIN_USABLE_PRESSURE_LEVELS,
): boolean {
  return usablePressureLevelCount(samples) >= minimumLevels;
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
): PressureForecastResponse {
  if (!isRecord(raw) || !isRecord(raw.hourly)) {
    throw new Error("气压上游返回了无法识别的 hourly 数据");
  }
  const hourly = raw.hourly;
  const rawTimes = hourly.time;
  if (
    !Array.isArray(rawTimes) ||
    rawTimes.length === 0 ||
    !rawTimes.every((time): time is string => typeof time === "string")
  ) {
    throw new Error("气压上游返回了无效逐小时时间轴");
  }
  const modelElevation = numberOrNull(raw.elevation);
  if (modelElevation === null) {
    throw new Error("气压上游缺少可靠的模式地形高程 elevation");
  }

  const times = rawTimes;
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

  const profiles: PressureForecastResponse["profiles"] = {};
  times.forEach((time, index) => {
    profiles[time] = PRESSURE_LEVELS.map((pressure) => ({
      pressure,
      cloudCover: numberOrNull(
        valueAt(hourly, `cloud_cover_${pressure}hPa`, index),
      ),
      humidity: numberOrNull(
        valueAt(hourly, `relative_humidity_${pressure}hPa`, index),
      ),
      temperature: numberOrNull(
        valueAt(hourly, `temperature_${pressure}hPa`, index),
      ),
      heightMsl: numberOrNull(
        valueAt(hourly, `geopotential_height_${pressure}hPa`, index),
      ),
    }));
  });

  if (!Object.values(profiles).some((profile) => hasUsablePressureProfile(profile))) {
    throw new Error("气压上游没有任何小时具备至少 6 个完整压力层");
  }

  return {
    locationId,
    modelElevation,
    timezone: typeof raw.timezone === "string" ? raw.timezone : "Asia/Shanghai",
    utcOffsetSeconds: numberOrNull(raw.utc_offset_seconds) ?? 0,
    fetchedAt: new Date().toISOString(),
    source: "Open-Meteo",
    model,
    stale: false,
    hourly: times.map((time, index) => ({
      time,
      temperature: numberOrNull(valueAt(hourly, "temperature_2m", index)),
    })),
    profiles,
  };
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
): Promise<PressureForecastBatchResult> {
  const url = buildPressureForecastBatchUrl(locations, date, model);
  const raw = await requestPressureJson(url, signal);
  const list = Array.isArray(raw) ? raw : [raw];
  if (list.length !== locations.length) {
    throw new Error(
      `气压上游返回 ${list.length} 个地点，与请求的 ${locations.length} 个地点不匹配`,
    );
  }

  const data: Record<string, PressureForecastResponse> = {};
  const errors: Record<string, string> = {};
  locations.forEach((location, index) => {
    try {
      data[location.id] = parsePressureForecast(list[index], location.id, model);
    } catch (error) {
      errors[location.id] =
        error instanceof Error ? error.message : "气压剖面解析失败";
    }
  });

  if (Object.keys(data).length === 0) {
    throw new Error(Object.values(errors)[0] ?? "气压剖面不可用");
  }
  return { data, errors };
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
  return parsePressureForecast(entry, "pressure", model);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
