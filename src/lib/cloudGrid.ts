import { normalizeEpochHours, resolveWallHour, validAbsoluteHours } from "./absoluteForecastTime";
import type L from "leaflet";
import { maxForecastDaysForModel } from "@/lib/forecastModelPolicy";
import { normalizeForecastDaysForModel, requestForecastResponse } from "@/lib/forecastClient";
import type {
  CloudGridData,
  CloudGridSample,
  ForecastModel,
  HourWeather,
  LocationForecast,
} from "@/lib/types";

export function generateGridBounds(
  bounds: L.LatLngBounds,
  rows = 5,
  cols = 6,
): {
  samples: CloudGridSample[];
  rect: CloudGridData["bounds"];
  rows: number;
  cols: number;
} {
  const safeRows = Math.max(2, Math.floor(rows));
  const safeCols = Math.max(2, Math.floor(cols));
  const north = Math.min(90, bounds.getNorth());
  const south = Math.max(-90, bounds.getSouth());
  const east = Math.min(180, Math.max(-180, bounds.getEast()));
  const west = Math.min(180, Math.max(-180, bounds.getWest()));
  const latStep = (north - south) / (safeRows - 1);
  const lngStep = (east - west) / (safeCols - 1);
  const samples: CloudGridSample[] = [];
  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      let longitude = west + lngStep * col;
      if (longitude > 180) longitude -= 360;
      if (longitude < -180) longitude += 360;
      samples.push({
        latitude: Math.max(-90, Math.min(90, south + latStep * row)),
        longitude,
      });
    }
  }
  return {
    samples,
    rect: { north, south, east, west },
    rows: safeRows,
    cols: safeCols,
  };
}

export async function fetchCloudGrid(
  samples: CloudGridSample[],
  nightKeys: string[],
  days: number,
  model: ForecastModel = "best_match",
  rows = 5,
  cols = 6,
  signal?: AbortSignal,
  forceRefresh = false,
): Promise<CloudGridData> {
  if (!samples.length) throw new Error("云图网格没有采样点");
  void signal;
  const result = await requestForecastResponse(samples, model, normalizeForecastDaysForModel(days, model), forceRefresh);
  const data = result.data;
  const forecasts = data.locations as LocationForecast[];
  if (forecasts.length !== samples.length) {
    throw new Error(
      `云图网格响应数量不匹配：采样 ${samples.length} 点，收到 ${forecasts.length} 点`,
    );
  }
  const absolute = forecasts.every(forecast => forecast.metadata?.timeAxisVersion === "epoch-v1");
  const legacy = forecasts.every(forecast => forecast.metadata?.timeAxisVersion === undefined);
  const expectedTimes = forecasts[0]?.hourly.map((hour) => hour.time) ?? [];
  if (!expectedTimes.length || forecasts.some((forecast, index) =>
    forecast.metadata?.model !== model ||
    (forecast.requestedLatitude !== undefined && Math.abs(forecast.requestedLatitude - samples[index]!.latitude) > 1e-5) ||
    (forecast.requestedLongitude !== undefined && Math.abs(forecast.requestedLongitude - samples[index]!.longitude) > 1e-5) ||
    (absolute ? !validAbsoluteHours(forecast.hourly, forecast.timezone) :
      !legacy || forecast.timezone !== forecasts[0].timezone || forecast.utcOffsetSeconds !== forecasts[0].utcOffsetSeconds ||
      forecast.hourly.length !== expectedTimes.length ||
      forecast.hourly.some((hour, hourIndex) => hour.time !== expectedTimes[hourIndex])),
  )) {
    throw new Error("云图网格返回的模型或时间轴不一致");
  }
  if (absolute && Math.max(...forecasts.map(forecast => forecast.hourly[0].epochSeconds!)) >
    Math.min(...forecasts.map(forecast => forecast.hourly.at(-1)!.epochSeconds!))) {
    throw new Error("云图网格绝对时间范围没有重叠");
  }
  const stale = result.stale || legacy;
  const latitudes = samples.map((sample) => sample.latitude);
  const longitudes = samples.map((sample) => sample.longitude);
  const sourceTimes = [
    data.metadata?.sourceFetchedAt,
    data.metadata?.fetchedAt,
    ...forecasts.flatMap((forecast) => [
      forecast.metadata?.sourceFetchedAt,
      forecast.metadata?.fetchedAt,
      forecast.fetchedAt,
    ]),
  ].filter((value): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)));
  sourceTimes.sort((left, right) => Date.parse(left) - Date.parse(right));
  const sourceFetchedAt = sourceTimes[0] ?? null;
  return {
    samples,
    bounds: {
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      west: Math.min(...longitudes),
    },
    forecasts,
    nightKeys,
    fetchedAt: data.metadata?.fetchedAt ?? forecasts[0]?.fetchedAt ?? "",
    sourceFetchedAt,
    stale,
    ...(stale ? { missingFields: [legacy ? "旧格式天气时间轴，仅供降级查看" : "源天气数据过期或降级"] } : {}),
    model,
    rows,
    cols,
  };
}

function shanghaiDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function forecastDaysForRange(
  startKey: string,
  rangeCount: number,
  now = new Date(),
  model: ForecastModel = "best_match",
): number {
  const today = Date.parse(`${shanghaiDateKey(now)}T00:00:00Z`);
  const target = Date.parse(`${startKey}T00:00:00Z`);
  const maximum = maxForecastDaysForModel(model);
  if (!Number.isFinite(target)) {
    return Math.min(maximum, Math.max(2, rangeCount + 1));
  }
  const leadDays = Math.floor((target - today) / 86_400_000);
  return Math.min(maximum, Math.max(2, leadDays + rangeCount + 1));
}

export function forecastDaysForNight(
  nightKey: string,
  now = new Date(),
  model: ForecastModel = "best_match",
): number {
  const today = Date.parse(`${shanghaiDateKey(now)}T00:00:00Z`);
  const target = Date.parse(`${nightKey}T00:00:00Z`);
  const maximum = maxForecastDaysForModel(model);
  if (!Number.isFinite(target)) return 2;
  const leadDays = Math.floor((target - today) / 86_400_000);
  return Math.min(maximum, Math.max(2, leadDays + 2));
}

export function cloudLayerValueToColor(
  layer: "high" | "mid" | "low",
  value: number,
): string {
  const clamped = Math.max(0, Math.min(100, value));
  const palette = {
    high: [121, 207, 226],
    mid: [212, 178, 115],
    low: [169, 155, 247],
  } as const;
  const [red, green, blue] = palette[layer];
  const alpha = clamped === 0 ? 0 : 0.18 + (clamped / 100) * 0.57;
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
}

export function idwInterpolate(
  px: number,
  py: number,
  points: Array<{ x: number; y: number; value: number }>,
  power = 2,
): number {
  if (!points.length) return 0;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dx = px - point.x;
    const dy = py - point.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < 1e-10) return point.value;
    const weight = 1 / Math.pow(Math.sqrt(distanceSquared), power);
    numerator += weight * point.value;
    denominator += weight;
  }
  return denominator > 0 ? numerator / denominator : 0;
}

export function bilinearInterpolate(
  u: number,
  v: number,
  values: Array<number | null | undefined>,
  rows: number,
  cols: number,
): number | null {
  if (rows < 1 || cols < 1 || values.length < rows * cols) return null;
  if (rows === 1 && cols === 1) return values[0] ?? null;
  const x = Math.max(0, Math.min(cols - 1, u));
  const y = Math.max(0, Math.min(rows - 1, v));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(cols - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const corners = [
    { value: values[y0 * cols + x0], weight: (1 - tx) * (1 - ty) },
    { value: values[y0 * cols + x1], weight: tx * (1 - ty) },
    { value: values[y1 * cols + x0], weight: (1 - tx) * ty },
    { value: values[y1 * cols + x1], weight: tx * ty },
  ].filter(
    (corner) =>
      typeof corner.value === "number" && Number.isFinite(corner.value),
  );
  if (!corners.length) return null;
  const totalWeight = corners.reduce((sum, corner) => sum + corner.weight, 0);
  return totalWeight > 0
    ? corners.reduce(
        (sum, corner) => sum + (corner.value as number) * corner.weight,
        0,
      ) / totalWeight
    : null;
}

/** Resolve the display clock once; a grid point never owns the selected-point timezone. */
export function resolveCloudGridEpoch(
  grid: CloudGridData,
  time: string | null | undefined,
  epochSeconds: number | null | undefined,
  timeZone: string | undefined,
  pointForecast?: LocationForecast | null,
): number | null {
  if (epochSeconds != null) return Number.isSafeInteger(epochSeconds) ? epochSeconds : null;
  if (!time || !timeZone) return null;
  if (pointForecast) {
    return pointForecast.metadata?.timeAxisVersion === "epoch-v1"
      ? resolveWallHour(pointForecast.hourly, time)?.epochSeconds ?? null : null;
  }
  const sources = [
    ...grid.forecasts.filter(forecast => forecast.timezone === timeZone),
    ...grid.forecasts.filter(forecast => forecast.timezone !== timeZone),
  ];
  try {
    for (const source of sources) {
      if (source.metadata?.timeAxisVersion !== "epoch-v1") continue;
      const hour = resolveWallHour(normalizeEpochHours(source.hourly.map(hour => hour.epochSeconds!), timeZone), time);
      if (hour) return hour.epochSeconds ?? null;
    }
  } catch { return null; }
  return null;
}

function hoursAt(
  grid: CloudGridData,
  timeOrIndex: string | number,
  epochSeconds?: number | null,
): Array<HourWeather | undefined> {
  if (epochSeconds != null) {
    return grid.forecasts.map(forecast => forecast.hourly.find(hour => hour.epochSeconds === epochSeconds));
  }
  const source = grid.forecasts[0];
  const sameClock = source && grid.forecasts.every(forecast => forecast.timezone === source.timezone && forecast.utcOffsetSeconds === source.utcOffsetSeconds);
  if (!sameClock) return grid.forecasts.map(() => undefined);
  const sourceHour = typeof timeOrIndex === "string" ? resolveWallHour(source.hourly, timeOrIndex) : source.hourly[timeOrIndex];
  if (source?.metadata?.timeAxisVersion === "epoch-v1") {
    // null explicitly means that the owning clock could not resolve this selection.
    return grid.forecasts.map(forecast => epochSeconds === null || sourceHour?.epochSeconds == null ? undefined :
      forecast.hourly.find(hour => hour.epochSeconds === sourceHour.epochSeconds));
  }
  return grid.forecasts.map(forecast => sourceHour ? resolveWallHour(forecast.hourly, sourceHour.time) ?? undefined : undefined);
}

function meanNumber(
  values: Array<number | null | undefined>,
  digits = 1,
): number | null {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!valid.length) return null;
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Number(mean.toFixed(digits));
}

function meanDirection(
  values: Array<number | null | undefined>,
): number | null {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!valid.length) return null;
  const radians = valid.map((value) => (value * Math.PI) / 180);
  const x = radians.reduce((sum, value) => sum + Math.cos(value), 0);
  const y = radians.reduce((sum, value) => sum + Math.sin(value), 0);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function modeNumber(
  values: Array<number | null | undefined>,
): number | null {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (!valid.length) return null;
  const counts = new Map<number, number>();
  for (const value of valid) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

export function aggregateForecastHour(
  hours: Array<HourWeather | undefined>,
  time: string,
): HourWeather | null {
  const valid = hours.filter((hour): hour is HourWeather => Boolean(hour));
  if (!valid.length) return null;
  return {
    time,
    epochSeconds: valid.every(hour => hour.epochSeconds === valid[0].epochSeconds) ? valid[0].epochSeconds : undefined,
    utcOffsetSeconds: valid[0].utcOffsetSeconds,
    temperature: meanNumber(valid.map((hour) => hour.temperature)),
    humidity: meanNumber(valid.map((hour) => hour.humidity)),
    dewPoint: meanNumber(valid.map((hour) => hour.dewPoint)),
    precipitationProbability: meanNumber(
      valid.map((hour) => hour.precipitationProbability),
    ),
    precipitation: meanNumber(valid.map((hour) => hour.precipitation)),
    weatherCode: modeNumber(valid.map((hour) => hour.weatherCode)),
    cloudCover: meanNumber(valid.map((hour) => hour.cloudCover), 0),
    cloudLow: meanNumber(valid.map((hour) => hour.cloudLow), 0),
    cloudMid: meanNumber(valid.map((hour) => hour.cloudMid), 0),
    cloudHigh: meanNumber(valid.map((hour) => hour.cloudHigh), 0),
    visibility: meanNumber(valid.map((hour) => hour.visibility), 0),
    windSpeed: meanNumber(valid.map((hour) => hour.windSpeed)),
    windGust: meanNumber(valid.map((hour) => hour.windGust)),
    windDirection: meanDirection(valid.map((hour) => hour.windDirection)),
  };
}

export function getValuesAtTime(
  gridData: CloudGridData,
  timeOrIndex: string | number,
  epochSeconds?: number | null,
): {
  high: Array<number | null>;
  mid: Array<number | null>;
  low: Array<number | null>;
} {
  const hours = hoursAt(gridData, timeOrIndex, epochSeconds);
  return {
    high: hours.map(
      (hour) => hour?.cloudHigh ?? null,
    ),
    mid: hours.map(
      (hour) => hour?.cloudMid ?? null,
    ),
    low: hours.map(
      (hour) => hour?.cloudLow ?? null,
    ),
  };
}

export function getCloudCoverAtTime(
  gridData: CloudGridData,
  timeOrIndex: string | number,
  epochSeconds?: number | null,
): Array<number | null> {
  return hoursAt(gridData, timeOrIndex, epochSeconds).map(
    (hour) => hour?.cloudCover ?? null,
  );
}

export function getWeatherValuesAtTime(
  gridData: CloudGridData,
  timeOrIndex: string | number,
  epochSeconds?: number | null,
): {
  precipitation: Array<number | null>;
  windSpeed: Array<number | null>;
  windDirection: Array<number | null>;
} {
  const hours = hoursAt(gridData, timeOrIndex, epochSeconds);
  return {
    precipitation: hours.map(
      (hour) => hour?.precipitation ?? null,
    ),
    windSpeed: hours.map(
      (hour) => hour?.windSpeed ?? null,
    ),
    windDirection: hours.map(
      (hour) => hour?.windDirection ?? null,
    ),
  };
}

export function averageLayer(
  values: Array<number | null | undefined>,
): number | null {
  const valid = values.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  return valid.length
    ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length)
    : null;
}

export function cloudValueToColor(value: number, alpha = 0.5): string {
  const clamped = Math.max(0, Math.min(100, value));
  const stops: Array<{ at: number; rgb: [number, number, number] }> = [
    { at: 0, rgb: [0, 0, 0] },
    { at: 20, rgb: [0x79, 0xcf, 0xe2] },
    { at: 50, rgb: [0xd4, 0xb2, 0x73] },
    { at: 80, rgb: [0xfc, 0x5a, 0x49] },
    { at: 100, rgb: [0xcb, 0x77, 0x68] },
  ];
  let lower = stops[0]!;
  let upper = stops.at(-1)!;
  for (let index = 0; index < stops.length - 1; index += 1) {
    if (clamped >= stops[index]!.at && clamped <= stops[index + 1]!.at) {
      lower = stops[index]!;
      upper = stops[index + 1]!;
      break;
    }
  }
  const range = upper.at - lower.at;
  const ratio = range > 0 ? (clamped - lower.at) / range : 0;
  const channel = (index: number) =>
    Math.round(lower.rgb[index] + (upper.rgb[index] - lower.rgb[index]) * ratio);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${(alpha * (clamped / 100)).toFixed(3)})`;
}
