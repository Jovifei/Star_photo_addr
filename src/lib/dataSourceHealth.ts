import { hasDarkSkyLayer } from "@/lib/assets";
import type {
  DataSourceHealthResponse,
  DataSourceProbe,
} from "@/lib/dataSourceStatus";
import {
  OPEN_METEO_FORECAST_URL,
} from "@/lib/forecast";
import { GIBS_CAPABILITIES_URL, GIBS_LAYERS } from "@/lib/gibs";
import {
  LIGHT_POLLUTION_TILE_URL,
  materializeLightPollutionTile,
} from "@/lib/lightPollution";
import { TimedCache } from "@/lib/serverCache";

const HEALTH_CACHE_TTL_MS = 5 * 60 * 1000;
const healthCache = new TimedCache<DataSourceHealthResponse>(2);

function probeResult(
  id: DataSourceProbe["id"],
  label: string,
  status: DataSourceProbe["status"],
  detail: string,
  checkedAt: string,
  latencyMs?: number,
): DataSourceProbe {
  return { id, label, status, detail, checkedAt, latencyMs };
}

async function withProbeTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 10_000,
): Promise<{ value: T; latencyMs: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    return {
      value: await task(controller.signal),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function weatherProbe(checkedAt: string): Promise<DataSourceProbe> {
  try {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set("latitude", "30.2741");
    url.searchParams.set("longitude", "120.1551");
    url.searchParams.set("hourly", "cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high");
    url.searchParams.set("timezone", "Asia/Shanghai");
    url.searchParams.set("forecast_days", "1");
    const result = await withProbeTimeout(async (signal) => {
      const response = await fetch(url, {
        signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json() as {
        hourly?: Record<string, unknown[]>;
      };
      if (
        !Array.isArray(payload.hourly?.time) ||
        !Array.isArray(payload.hourly?.cloud_cover) ||
        !payload.hourly.cloud_cover.some(
          (value) => typeof value === "number" && Number.isFinite(value),
        )
      ) {
        throw new Error("云量字段缺失");
      }
      return payload.hourly.time.length;
    });
    return probeResult(
      "weather",
      "天气 / Open-Meteo",
      "available",
      `总云量及高、中、低云字段可用 · ${result.value} 个小时`,
      checkedAt,
      result.latencyMs,
    );
  } catch (error) {
    return probeResult(
      "weather",
      "天气 / Open-Meteo",
      "degraded",
      error instanceof Error ? error.message : "天气源不可达",
      checkedAt,
    );
  }
}

async function satelliteProbe(checkedAt: string): Promise<DataSourceProbe> {
  try {
    const result = await withProbeTimeout(async (signal) => {
      const response = await fetch(GIBS_CAPABILITIES_URL, {
        signal,
        cache: "no-store",
        headers: { Accept: "application/xml,text/xml" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const missing = Object.values(GIBS_LAYERS).filter(
        (identifier) => !xml.includes(identifier),
      );
      if (missing.length) {
        throw new Error(`图层目录缺少 ${missing.join("、")}`);
      }
      return Object.keys(GIBS_LAYERS).length;
    }, 15_000);
    return probeResult(
      "satellite",
      "卫星 / NASA GIBS",
      "available",
      `Himawari 云图与 VIIRS Black Marble 目录可用`,
      checkedAt,
      result.latencyMs,
    );
  } catch (error) {
    return probeResult(
      "satellite",
      "卫星 / NASA GIBS",
      "degraded",
      error instanceof Error ? error.message : "卫星目录不可达",
      checkedAt,
    );
  }
}

async function lightPollutionProbe(
  checkedAt: string,
): Promise<DataSourceProbe> {
  try {
    const tileUrl = materializeLightPollutionTile(
      LIGHT_POLLUTION_TILE_URL,
      4,
      12,
      6,
    );
    const result = await withProbeTimeout(async (signal) => {
      const response = await fetch(tileUrl, {
        signal,
        cache: "no-store",
        headers: {
          Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
          "User-Agent": "star-weather-planner/0.3.1 data-source-health",
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.arrayBuffer();
      if (!contentType.startsWith("image/") || body.byteLength < 64) {
        throw new Error("瓦片响应不是有效图片");
      }
      return body.byteLength;
    }, 15_000);
    return probeResult(
      "light-pollution",
      "光污染参考 / VIIRS 2023",
      "available",
      `第三方视觉瓦片可用 · ${result.value} B；不等同于现场 Bortle/SQM`,
      checkedAt,
      result.latencyMs,
    );
  } catch (error) {
    return probeResult(
      "light-pollution",
      "光污染参考 / VIIRS 2023",
      "degraded",
      error instanceof Error ? error.message : "光污染瓦片不可达",
      checkedAt,
    );
  }
}

export async function getDataSourceHealth(
  forceRefresh = false,
): Promise<DataSourceHealthResponse> {
  const cached = healthCache.readFresh("all", HEALTH_CACHE_TTL_MS);
  if (!forceRefresh && cached) {
    return { ...cached.value, cached: true };
  }

  const checkedAt = new Date().toISOString();
  const [weather, satellite, lightPollution] = await Promise.all([
    weatherProbe(checkedAt),
    satelliteProbe(checkedAt),
    lightPollutionProbe(checkedAt),
  ]);
  const tiandituConfigured = Boolean(
    process.env.NEXT_PUBLIC_TIANDITU_TOKEN?.trim(),
  );
  const tianditu = probeResult(
    "tianditu",
    "中文注记 / 天地图",
    tiandituConfigured ? "available" : "unconfigured",
    tiandituConfigured
      ? "构建时 Token 已配置"
      : "未配置时使用内置中文城市注记",
    checkedAt,
  );
  const localDarkSkyInstalled = hasDarkSkyLayer();
  const localDarkSky = probeResult(
    "local-dark-sky",
    "Bortle / SQM 本地栅格",
    localDarkSkyInstalled ? "available" : "not-installed",
    localDarkSkyInstalled
      ? "已显式启用授权本地资产"
      : "未安装授权栅格，不会伪造 Bortle/SQM 数值",
    checkedAt,
  );
  const sources: DataSourceHealthResponse["sources"] = {
    weather,
    satellite,
    "light-pollution": lightPollution,
    tianditu,
    "local-dark-sky": localDarkSky,
  };
  const status = [weather, satellite, lightPollution].every(
    (source) => source.status === "available",
  )
    ? "ok"
    : "degraded";
  const response: DataSourceHealthResponse = {
    status,
    checkedAt,
    cached: false,
    sources,
  };
  healthCache.write("all", response);
  return response;
}
