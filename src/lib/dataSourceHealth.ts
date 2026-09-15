import { hasDarkSkyLayer } from "@/lib/assets";
import { GIBS_LAYERS } from "@/lib/gibs";
import {
  LIGHT_POLLUTION_TILE_URL,
  lightPollutionTemplateError,
  materializeLightPollutionTile,
} from "@/lib/lightPollution";
import { OPEN_METEO_FORECAST_URL, applyOpenMeteoApiKey, openMeteoModelParameter, withOpenMeteoProviderSlot, openMeteoCooldownRemainingMs } from "@/lib/forecast";
import { DEFAULT_SCORING_MODEL, SCORING_REQUIRED_SERIES, missingScoringSeries } from "@/lib/forecastPolicy";
import type { ForecastModel } from "@/lib/types";
import { TimedCache } from "@/lib/serverCache";
import { getGibsCapabilities } from "@/lib/server/gibsCapabilities";
import type {
  DataSourceHealthResponse,
  DataSourceProbe,
} from "@/lib/dataSourceStatus";

const REQUIRED_CLOUD_FIELDS = [
  { key: "cloud_cover", label: "总云量" },
  { key: "cloud_cover_low", label: "低云" },
  { key: "cloud_cover_mid", label: "中云" },
  { key: "cloud_cover_high", label: "高云" },
] as const;

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

const HEALTH_CACHE_TTL_MS = boundedInteger(
  "DATA_SOURCE_HEALTH_TTL_MS",
  5 * 60_000,
  30_000,
  60 * 60_000,
);
const WEATHER_PROBE_TTL_MS = boundedInteger(
  "DATA_SOURCE_WEATHER_PROBE_TTL_MS",
  5 * 60_000,
  30_000,
  60 * 60_000,
);
const SATELLITE_PROBE_TTL_MS = boundedInteger(
  "DATA_SOURCE_SATELLITE_PROBE_TTL_MS",
  60 * 60_000,
  5 * 60_000,
  24 * 60 * 60_000,
);
const LIGHT_POLLUTION_PROBE_TTL_MS = boundedInteger(
  "DATA_SOURCE_LIGHT_POLLUTION_PROBE_TTL_MS",
  15 * 60_000,
  60_000,
  24 * 60 * 60_000,
);
const PROBE_TIMEOUT_MS = boundedInteger(
  "DATA_SOURCE_PROBE_TIMEOUT_MS",
  15_000,
  2_000,
  60_000,
);
const FORCE_REFRESH_COOLDOWN_MS = boundedInteger(
  "DATA_SOURCE_FORCE_REFRESH_COOLDOWN_MS",
  60_000,
  5_000,
  15 * 60_000,
);

const healthCache = new TimedCache<DataSourceHealthResponse>(8);
const sourceProbeCache = new TimedCache<DataSourceProbe>(8);
const healthInFlight = new Map<ForecastModel, Promise<DataSourceHealthResponse>>();
const lastProbeStartedAt = new Map<ForecastModel, number>();

function numericSeries(values: unknown, expectedLength: number): boolean {
  return (
    Array.isArray(values) &&
    values.length === expectedLength &&
    values.every(
      (value) =>
        value === null ||
        (typeof value === "number" && Number.isFinite(value)),
    ) &&
    values.some(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  );
}

/**
 * Returns human-readable missing/invalid cloud channels. A health probe is not
 * considered successful unless the same payload contains total, low, mid and
 * high cloud arrays aligned to the hourly time axis.
 */
export function missingCloudFields(
  hourly: Record<string, unknown> | undefined,
): string[] {
  const times = hourly?.time;
  if (!Array.isArray(times) || times.length === 0) {
    return ["逐小时时间"];
  }
  return REQUIRED_CLOUD_FIELDS.filter(
    ({ key }) => !numericSeries(hourly?.[key], times.length),
  ).map(({ label }) => label);
}

export interface WeatherCapabilities {
  cloudAvailable: boolean;
  scoringAvailable: boolean;
  missingCloudFields: string[];
  missingScoringFields: string[];
}

export function assessWeatherCapabilities(
  hourly: Record<string, unknown> | undefined,
): WeatherCapabilities {
  const missingCloud = missingCloudFields(hourly);
  const missingScoring = missingScoringSeries(hourly);
  return {
    cloudAvailable: missingCloud.length === 0,
    scoringAvailable: missingScoring.length === 0,
    missingCloudFields: missingCloud,
    missingScoringFields: missingScoring,
  };
}

/** Keep provider details useful without reflecting URLs or upstream bodies. */
export function sanitizeProbeError(
  error: unknown,
  sourceLabel: string,
): string {
  if (error instanceof Error) {
    if (
      error.name === "AbortError" ||
      /aborted|timeout|超时/i.test(error.message)
    ) {
      return `${sourceLabel}请求超时`;
    }
    const httpStatus = error.message.match(/HTTP\s+(\d{3})/i)?.[1];
    if (httpStatus) return `${sourceLabel}返回 HTTP ${httpStatus}`;
    if (
      /字段不可用|格式无法识别|图层目录缺少|瓦片响应不是图片|瓦片内容过小|瓦片模板无效/.test(
        error.message,
      )
    ) {
      return error.message.slice(0, 180);
    }
  }
  return `${sourceLabel}暂时不可用`;
}

async function timedFetch(
  input: string,
  accept: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    return await fetch(input, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        Accept: accept,
        "User-Agent": "star-weather-planner-data-health/0.3.1",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeWeather(checkedAt: string, model: ForecastModel): Promise<DataSourceProbe> {
  const startedAt = Date.now();
  const unavailable: WeatherCapabilities = {
    cloudAvailable: false,
    scoringAvailable: false,
    missingCloudFields: ["逐小时时间"],
    missingScoringFields: ["有效且唯一的逐小时时间轴"],
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const label = `Open-Meteo ${model.toUpperCase()} 评分字段`;
  try {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set("latitude", "30.2741");
    url.searchParams.set("longitude", "120.1551");
    url.searchParams.set("hourly", SCORING_REQUIRED_SERIES.map(([key]) => key).join(","));
    url.searchParams.set("timezone", "Asia/Shanghai");
    url.searchParams.set("forecast_days", "1");
    url.searchParams.set("wind_speed_unit", "ms");
    const providerModel = openMeteoModelParameter(model);
    if (providerModel) url.searchParams.set("models", providerModel);
    applyOpenMeteoApiKey(url.searchParams);
    // Same provider circuit as single-point and Finder requests. Never bypass 429.
    const response = await withOpenMeteoProviderSlot(() => fetch(url.toString(), {
      signal: controller.signal, cache: "no-store", headers: { Accept: "application/json" },
    }));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { hourly?: Record<string, unknown> } | null;
    const capabilities = assessWeatherCapabilities(payload?.hourly);
    if (capabilities.missingScoringFields.length) {
      return {
        id: "weather",
        label,
        status: "degraded",
        detail: capabilities.cloudAvailable
          ? `云量可查看，评分字段不足：${capabilities.missingScoringFields.join("、")}`
          : `云量字段不足：${capabilities.missingCloudFields.join("、")}`,
        checkedAt,
        latencyMs: Date.now() - startedAt,
        model,
        ...capabilities,
      };
    }
    const hours = Array.isArray(payload?.hourly?.time) ? payload.hourly.time.length : 0;
    return {
      id: "weather", label, status: "available",
      detail: `${model.toUpperCase()} 杭州单点 ${hours} 个时次：评分字段包含能见度且至少一小时完整；不代表全部地点、所有时次或预测准确率`,
      checkedAt, latencyMs: Date.now() - startedAt, model, ...capabilities,
    };
  } catch (error) {
    return {
      id: "weather", label, status: "degraded",
      detail: `${model.toUpperCase()} 单点检查：${sanitizeProbeError(error, "天气上游")}`,
      checkedAt, latencyMs: Date.now() - startedAt, model, ...unavailable,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeSatellite(
  checkedAt: string,
  forceRefresh: boolean,
): Promise<DataSourceProbe> {
  const startedAt = Date.now();
  try {
    const capability = await getGibsCapabilities(forceRefresh);
    const missing = Object.values(GIBS_LAYERS).filter(
      (identifier) => !capability.xml.includes(identifier),
    );
    if (missing.length) {
      throw new Error(`NASA GIBS 图层目录缺少 ${missing.join("、")}`);
    }
    return {
      id: "satellite",
      label: "NASA GIBS",
      status: capability.stale ? "degraded" : "available",
      detail: capability.stale
        ? "正在使用最近一次成功的 Himawari / VIIRS 图层目录"
        : capability.refreshSuppressed
          ? "GIBS 强制复检处于冷却保护，继续使用最近目录"
          : "Himawari 云图与 VIIRS Black Marble 图层目录可用",
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: "satellite",
      label: "NASA GIBS",
      status: "degraded",
      detail: sanitizeProbeError(error, "卫星图层目录"),
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function probeLightPollution(
  checkedAt: string,
): Promise<DataSourceProbe> {
  const startedAt = Date.now();
  try {
    const templateIssue = lightPollutionTemplateError(
      LIGHT_POLLUTION_TILE_URL,
    );
    if (templateIssue) {
      throw new Error(`光污染瓦片模板无效：${templateIssue}`);
    }
    const tileUrl = materializeLightPollutionTile(
      LIGHT_POLLUTION_TILE_URL,
      4,
      12,
      6,
    );
    const response = await timedFetch(tileUrl, "image/*,*/*;q=0.8");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("image/")) {
      throw new Error("光污染瓦片响应不是图片");
    }
    const body = await response.arrayBuffer();
    if (body.byteLength < 64) throw new Error("光污染瓦片内容过小");
    return {
      id: "light-pollution",
      label: "VIIRS 2023 光污染",
      status: "available",
      detail: "第三方视觉 WMTS 可用；仅供空间参考，非 Bortle/SQM 实测",
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: "light-pollution",
      label: "VIIRS 2023 光污染",
      status: "degraded",
      detail: sanitizeProbeError(error, "光污染瓦片"),
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
  }
}

async function cachedProbe(
  id: string,
  ttlMs: number,
  forceRefresh: boolean,
  loader: (checkedAt: string) => Promise<DataSourceProbe>,
): Promise<DataSourceProbe> {
  const cached = sourceProbeCache.read(id);
  if (!forceRefresh && cached && cached.ageMs <= ttlMs) {
    return cached.value;
  }
  const result = await loader(new Date().toISOString());
  sourceProbeCache.write(id, result);
  return result;
}

function staticConfigurationProbes(
  checkedAt: string,
): Pick<
  DataSourceHealthResponse["sources"],
  "tianditu" | "local-dark-sky"
> {
  const tiandituConfigured = Boolean(
    process.env.NEXT_PUBLIC_TIANDITU_TOKEN?.trim(),
  );
  const darkSkyInstalled = hasDarkSkyLayer();
  return {
    tianditu: {
      id: "tianditu",
      label: "天地图中文注记",
      status: tiandituConfigured ? "available" : "unconfigured",
      detail: tiandituConfigured
        ? "构建时已配置令牌"
        : "未配置令牌，使用内置中文城市注记",
      checkedAt,
    },
    "local-dark-sky": {
      id: "local-dark-sky",
      label: "本地 Bortle/SQM 栅格",
      status: darkSkyInstalled ? "available" : "not-installed",
      detail: darkSkyInstalled
        ? "已安装并显式启用授权栅格"
        : "未安装；页面不会根据视觉瓦片伪造 Bortle/SQM 数值",
      checkedAt,
    },
  };
}

async function runHealthProbes(
  forceRefresh: boolean,
  model: ForecastModel,
): Promise<DataSourceHealthResponse> {
  const checkedAt = new Date().toISOString();
  const [weather, satellite, lightPollution] = await Promise.all([
    cachedProbe(
      `weather|${model}`,
      WEATHER_PROBE_TTL_MS,
      forceRefresh,
      (sourceCheckedAt) => probeWeather(sourceCheckedAt, model),
    ),
    cachedProbe(
      "satellite",
      SATELLITE_PROBE_TTL_MS,
      forceRefresh,
      (sourceCheckedAt) =>
        probeSatellite(sourceCheckedAt, forceRefresh),
    ),
    cachedProbe(
      "light-pollution",
      LIGHT_POLLUTION_PROBE_TTL_MS,
      forceRefresh,
      probeLightPollution,
    ),
  ]);
  const staticSources = staticConfigurationProbes(checkedAt);
  const sources: DataSourceHealthResponse["sources"] = {
    weather,
    satellite,
    "light-pollution": lightPollution,
    ...staticSources,
  };
  const response: DataSourceHealthResponse = {
    status: [weather, satellite, lightPollution].every(
      (source) => source.status === "available",
    )
      ? "ok"
      : "degraded",
    model,
    cloudAvailable: weather.cloudAvailable === true,
    scoringAvailable: weather.scoringAvailable === true,
    missingCloudFields: weather.missingCloudFields ?? [],
    missingScoringFields: weather.missingScoringFields ?? [],
    checkedAt,
    cached: false,
    sources,
  };
  healthCache.write(model, response);
  return response;
}

function cachedResponse(
  cached: NonNullable<ReturnType<typeof healthCache.read>>,
  extras: Partial<DataSourceHealthResponse> = {},
): DataSourceHealthResponse {
  return {
    ...cached.value,
    cached: true,
    cacheAgeMs: cached.ageMs,
    coalesced: false,
    refreshSuppressed: false,
    nextRefreshAt: undefined,
    ...extras,
  };
}

export async function getDataSourceHealth(
  forceRefresh = false,
  model: ForecastModel = DEFAULT_SCORING_MODEL,
): Promise<DataSourceHealthResponse> {
  const now = Date.now();
  const cached = healthCache.read(model, now);
  const lastStartedAt = lastProbeStartedAt.get(model) ?? 0;
  // A cached positive probe must not hide a now-known provider cooldown.
  const withCooldown = (data: DataSourceHealthResponse): DataSourceHealthResponse => {
    const remaining = openMeteoCooldownRemainingMs();
    if (remaining <= 0) return data;
    return { ...data, status: "degraded", nextRefreshAt: new Date(Date.now() + remaining).toISOString(),
      cloudAvailable: false,
      scoringAvailable: false,
      missingScoringFields: [...new Set([...data.missingScoringFields, "Open-Meteo 限流冷却"])],
      sources: { ...data.sources, weather: { ...data.sources.weather, status: "degraded",
        cloudAvailable: false,
        scoringAvailable: false,
        detail: `${model.toUpperCase()} 上游 HTTP 429 冷却中；先前探针不代表当前评分链可用` } } };
  };
  if (!forceRefresh && cached && cached.ageMs <= HEALTH_CACHE_TTL_MS) return withCooldown(cachedResponse(cached));
  if (forceRefresh && cached && now - lastStartedAt < FORCE_REFRESH_COOLDOWN_MS) {
    return withCooldown(cachedResponse(cached, {
      refreshSuppressed: true,
      nextRefreshAt: new Date(lastStartedAt + FORCE_REFRESH_COOLDOWN_MS).toISOString(),
    }));
  }
  const shared = healthInFlight.get(model);
  if (shared) return withCooldown({ ...await shared, coalesced: true });
  lastProbeStartedAt.set(model, now);
  const task = runHealthProbes(forceRefresh, model);
  healthInFlight.set(model, task);
  try { return withCooldown(await task); }
  finally { if (healthInFlight.get(model) === task) healthInFlight.delete(model); }
}
