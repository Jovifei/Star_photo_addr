import { buildForecastUrl, clampForecastDays } from "./forecast";
import type { ForecastModel } from "./types";

export const PRESSURE_LEVELS = [
  1000,
  975,
  950,
  925,
  900,
  850,
  800,
  700,
  600,
  500,
] as const;

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
  profiles: Record<
    string,
    Array<{
      pressure: number;
      cloudCover: number | null;
      humidity: number | null;
      temperature: number | null;
      heightMsl: number | null;
    }>
  >;
}

function withPressureVariables(url: string): string {
  const parsed = new URL(url);
  const variables = PRESSURE_LEVELS.flatMap((level) => [
    `cloud_cover_${level}hPa`,
    `relative_humidity_${level}hPa`,
    `temperature_${level}hPa`,
    `geopotential_height_${level}hPa`,
  ]);
  parsed.searchParams.set(
    "hourly",
    `${parsed.searchParams.get("hourly")},${variables.join(",")}`,
  );
  return parsed.toString();
}

async function providerError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => null) as
    | { reason?: string }
    | null;
  return new Error(
    body?.reason
      ? `气压接口返回 ${response.status}：${body.reason}`
      : `气压接口返回 ${response.status}`,
  );
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
  let response: Response | null = null;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      response = await fetch(url, {
        signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (response.ok) break;
      lastError = await providerError(response);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error;
    }
  }
  if (!response?.ok) {
    throw lastError instanceof Error
      ? lastError
      : new Error("气压接口请求失败");
  }
  const data = (await response.json()) as {
    elevation: number;
    timezone: string;
    utc_offset_seconds?: number;
    hourly?: Record<string, (string | number | null)[]>;
  };
  const hourly = data.hourly;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error("气压上游返回了无法识别的 hourly 数据");
  }
  const availableLevels = PRESSURE_LEVELS.filter((level) =>
    Array.isArray(hourly[`cloud_cover_${level}hPa`]),
  );
  if (availableLevels.length < 6) {
    throw new Error(
      `气压上游仅返回 ${availableLevels.length} 个可用云层，无法形成可靠剖面`,
    );
  }

  const fetchedAt = new Date().toISOString();
  const profiles: PressureForecastResponse["profiles"] = {};
  const times = hourly.time as string[];
  times.forEach((time, index) => {
    profiles[time] = PRESSURE_LEVELS.map((pressure) => ({
      pressure,
      cloudCover: numberOrNull(
        hourly[`cloud_cover_${pressure}hPa`]?.[index],
      ),
      humidity: numberOrNull(
        hourly[`relative_humidity_${pressure}hPa`]?.[index],
      ),
      temperature: numberOrNull(
        hourly[`temperature_${pressure}hPa`]?.[index],
      ),
      heightMsl: numberOrNull(
        hourly[`geopotential_height_${pressure}hPa`]?.[index],
      ),
    }));
  });
  return {
    locationId: "pressure",
    modelElevation: data.elevation,
    timezone: data.timezone,
    utcOffsetSeconds: data.utc_offset_seconds ?? 0,
    fetchedAt,
    source: "Open-Meteo",
    model,
    stale: false,
    hourly: times.map((time, index) => ({
      time,
      temperature: numberOrNull(hourly.temperature_2m?.[index]),
    })),
    profiles,
  };
}

function numberOrNull(
  value: string | number | null | undefined,
): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
