import type L from "leaflet";
import { maxForecastDaysForModel } from "@/lib/forecast";
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
  const params = new URLSearchParams({
    latitude: samples.map((sample) => sample.latitude).join(","),
    longitude: samples.map((sample) => sample.longitude).join(","),
    days: String(days),
    model,
  });
  if (forceRefresh) params.set("refresh", "1");
  const response = await fetch(`/api/forecast?${params.toString()}`, {
    signal,
    cache: forceRefresh ? "no-store" : "default",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `云图网格请求失败 (${response.status})`);
  }
  const data = await response.json();
  const forecasts = (data.locations ?? []) as LocationForecast[];
  if (forecasts.length !== samples.length) {
    throw new Error(
      `云图网格响应数量不匹配：采样 ${samples.length} 点，收到 ${forecasts.length} 点`,
    );
  }
  const sortedForecasts = forecasts.map((forecast) => ({
    ...forecast,
    hourly: [...forecast.hourly].sort((left, right) =>
      left.time.localeCompare(right.time),
    ),
  }));
  const latitudes = samples.map((sample) => sample.latitude);
  const longitudes = samples.map((sample) => sample.longitude);
  return {
    samples,
    bounds: {
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      west: Math.min(...longitudes),
    },
    forecasts: sortedForecasts,
    nightKeys,
    fetchedAt: new Date().toISOString(),
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

function hourAt(
  forecast: LocationForecast,
  timeOrIndex: string | number,
): HourWeather | undefined {
  if (typeof timeOrIndex === "string") {
    return forecast.hourly.find((hour) => hour.time === timeOrIndex);
  }
  return forecast.hourly[
    Math.min(
      Math.max(0, timeOrIndex),
      Math.max(0, forecast.hourly.length - 1),
    )
  ];
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
): {
  high: Array<number | null>;
  mid: Array<number | null>;
  low: Array<number | null>;
} {
  return {
    high: gridData.forecasts.map(
      (forecast) => hourAt(forecast, timeOrIndex)?.cloudHigh ?? null,
    ),
    mid: gridData.forecasts.map(
      (forecast) => hourAt(forecast, timeOrIndex)?.cloudMid ?? null,
    ),
    low: gridData.forecasts.map(
      (forecast) => hourAt(forecast, timeOrIndex)?.cloudLow ?? null,
    ),
  };
}

export function getCloudCoverAtTime(
  gridData: CloudGridData,
  timeOrIndex: string | number,
): Array<number | null> {
  return gridData.forecasts.map(
    (forecast) => hourAt(forecast, timeOrIndex)?.cloudCover ?? null,
  );
}

export function getWeatherValuesAtTime(
  gridData: CloudGridData,
  timeOrIndex: string | number,
): {
  precipitation: Array<number | null>;
  windSpeed: Array<number | null>;
  windDirection: Array<number | null>;
} {
  return {
    precipitation: gridData.forecasts.map(
      (forecast) => hourAt(forecast, timeOrIndex)?.precipitation ?? null,
    ),
    windSpeed: gridData.forecasts.map(
      (forecast) => hourAt(forecast, timeOrIndex)?.windSpeed ?? null,
    ),
    windDirection: gridData.forecasts.map(
      (forecast) => hourAt(forecast, timeOrIndex)?.windDirection ?? null,
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
