// Cloud grid sampling + IDW interpolation + batch forecast logic.
//
// This module provides the spatial cloud-coverage data pipeline for the
// Phase 2 three-layer cloud overlay:
//   1. `generateGridBounds` — produces a uniform grid of sample points within
//      the current map viewport.
//   2. `fetchCloudGrid` — calls the existing `/api/forecast` route (which
//      already supports comma-separated multi-point requests) and filters the
//      results to the selected night's hours.
//   3. `idwInterpolate` — standard inverse-distance-weighted interpolation for
//      a single pixel position.
//   4. `getValuesAtTime` — extracts the three-layer cloud values (high/mid/low)
//      for all sample points at a given time index within the night window.
//
// All functions are pure (no side effects) except `fetchCloudGrid` which
// performs an HTTP request.

import type L from "leaflet";
import {
  isInNightRange,
} from "@/lib/nighttime";
import type {
  CloudGridData,
  CloudGridSample,
  ForecastModel,
  LocationForecast,
} from "@/lib/types";

/**
 * Generate a uniform grid of sample points within the given map bounds.
 *
 * @param bounds - Leaflet LatLngBounds of the current viewport.
 * @param rows - Number of rows (default 5).
 * @param cols - Number of columns (default 6).
 * @returns Array of sample points and the bounding rectangle.
 */
export function generateGridBounds(
  bounds: L.LatLngBounds,
  rows = 5,
  cols = 6,
): { samples: CloudGridSample[]; rect: CloudGridData["bounds"] } {
  // Clamp the viewport to a valid geographic range. Leaflet reports east > 180
  // (or west < -180) when the map is panned beyond the dateline with
  // worldCopyJump disabled; feeding those longitudes to Open-Meteo returns 502
  // and the cloud overlay silently fails to render.
  const north = Math.min(90, bounds.getNorth());
  const south = Math.max(-90, bounds.getSouth());
  const east = Math.min(180, Math.max(-180, bounds.getEast()));
  const west = Math.min(180, Math.max(-180, bounds.getWest()));

  const samples: CloudGridSample[] = [];
  const latStep = (north - south) / (rows - 1);
  const lngStep = (east - west) / (cols - 1);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const latitude = south + latStep * r;
      // Wrap longitude into [-180, 180] so a dateline-crossing view still
      // produces valid sample points.
      let longitude = west + lngStep * c;
      if (longitude > 180) longitude -= 360;
      if (longitude < -180) longitude += 360;
      samples.push({
        latitude: Math.max(-90, Math.min(90, latitude)),
        longitude,
      });
    }
  }

  return {
    samples,
    rect: { north, south, east, west },
  };
}

/**
 * Batch-fetch cloud forecasts for a set of sample points.
 *
 * Reuses the existing `/api/forecast` route, which already supports
 * comma-separated multi-point requests. The returned forecasts are filtered
 * to only the hours belonging to any of the requested nights (20:00 → 05:00).
 *
 * @param samples - Grid sample coordinates.
 * @param nightKeys - Night keys (YYYY-MM-DD); the timeline covers each in turn.
 * @param days - Number of forecast days to request.
 * @returns Complete CloudGridData with filtered forecasts.
 */
export async function fetchCloudGrid(
  samples: CloudGridSample[],
  nightKeys: string[],
  days: number,
  model: ForecastModel = "best_match",
): Promise<CloudGridData> {
  const latitudes = samples.map((s) => s.latitude).join(",");
  const longitudes = samples.map((s) => s.longitude).join(",");
  const url = `/api/forecast?latitude=${latitudes}&longitude=${longitudes}&days=${days}&model=${model}`;

  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `云图网格请求失败 (${response.status})`);
  }
  const data = await response.json();
  const forecasts: LocationForecast[] = (data.locations ?? []) as LocationForecast[];

  // Filter each forecast's hourly array to the requested nights and keep them
  // in chronological order so the timeline plays back correctly.
  const filteredForecasts = forecasts.map((forecast) => ({
    ...forecast,
    hourly: forecast.hourly
      .filter((hour) => isInNightRange(hour.time, nightKeys))
      .sort((a, b) => a.time.localeCompare(b.time)),
  }));

  // Compute the bounding rectangle from the samples.
  const latitudesNum = samples.map((s) => s.latitude);
  const longitudesNum = samples.map((s) => s.longitude);

  return {
    samples,
    bounds: {
      north: Math.max(...latitudesNum),
      south: Math.min(...latitudesNum),
      east: Math.max(...longitudesNum),
      west: Math.min(...longitudesNum),
    },
    forecasts: filteredForecasts,
    nightKeys,
    fetchedAt: new Date().toISOString(),
    model,
  };
}

/** Number of forecast days required to cover a range of nights from `startKey`. */
export function forecastDaysForRange(
  startKey: string,
  rangeCount: number,
  now = new Date(),
): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  const todayKey = formatter.format(now);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const target = Date.parse(`${startKey}T00:00:00Z`);
  if (!Number.isFinite(target)) return Math.min(16, rangeCount + 2);
  const leadDays = Math.floor((target - today) / 86_400_000);
  return Math.min(16, Math.max(2, leadDays + rangeCount + 1));
}

/** Number of forecast days required to include the selected evening. */
export function forecastDaysForNight(
  nightKey: string,
  now = new Date(),
): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayKey = formatter.format(now);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const target = Date.parse(`${nightKey}T00:00:00Z`);
  if (!Number.isFinite(target)) return 2;
  const leadDays = Math.floor((target - today) / 86_400_000);
  return Math.min(16, Math.max(2, leadDays + 2));
}

/** Layer-specific colour with opacity scaled by cloud proportion. */
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
  const [r, g, b] = palette[layer];
  // Minimum alpha raised to 0.18 so even light cloud cover is visible on the
  // dark basemap.  At 100 % the alpha hits 0.75 for a solid, readable overlay.
  const alpha = clamped === 0 ? 0 : 0.18 + (clamped / 100) * 0.57;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

/**
 * Inverse Distance Weighting interpolation.
 *
 * Computes the interpolated value at position (px, py) given a set of
 * known points with values. Points exactly at (px, py) return their value
 * directly to avoid division by zero.
 *
 * @param px - X coordinate of the interpolation point.
 * @param py - Y coordinate of the interpolation point.
 * @param points - Array of known points with { x, y, value }.
 * @param power - Distance decay power (default 2).
 * @returns Interpolated value (0 if no points).
 */
export function idwInterpolate(
  px: number,
  py: number,
  points: Array<{ x: number; y: number; value: number }>,
  power = 2,
): number {
  if (points.length === 0) return 0;

  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    const dx = px - point.x;
    const dy = py - point.y;
    const distSq = dx * dx + dy * dy;

    // If the point coincides with a sample, return its value directly.
    if (distSq < 1e-10) {
      return point.value;
    }

    const weight = 1 / Math.pow(Math.sqrt(distSq), power);
    numerator += weight * point.value;
    denominator += weight;
  }

  return denominator > 0 ? numerator / denominator : 0;
}

/**
 * Extract the three-layer cloud values for all sample points at a given
 * time index. For an N-night range each night contributes 10 hours, so the
 * index ranges over 0..(10*N-1) and maps directly onto the chronologically
 * sorted, night-filtered `hourly` arrays produced by `fetchCloudGrid`.
 *
 * @param gridData - The complete grid sampling data.
 * @param timeIndex - Flat index into the night-hour array.
 * @returns Three arrays of cloud coverage values (0-100), one per layer.
 */
export function getValuesAtTime(
  gridData: CloudGridData,
  timeIndex: number,
): { high: number[]; mid: number[]; low: number[] } {
  const high: number[] = [];
  const mid: number[] = [];
  const low: number[] = [];

  for (const forecast of gridData.forecasts) {
    const hour = forecast.hourly[Math.min(timeIndex, forecast.hourly.length - 1)];
    if (!hour) {
      high.push(0);
      mid.push(0);
      low.push(0);
      continue;
    }
    high.push(hour.cloudHigh ?? 0);
    mid.push(hour.cloudMid ?? 0);
    low.push(hour.cloudLow ?? 0);
  }

  return { high, mid, low };
}

/**
 * Compute the average cloud value for a layer across all sample points
 * at a given time index.
 *
 * @param values - Array of cloud values (0-100) for one layer.
 * @returns Average value (0-100), rounded.
 */
export function averageLayer(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * Map a cloud coverage value (0-100) to an RGBA colour string using the
 * design-token colour stops.
 *
 * Colour mapping:
 *   0%   → transparent
 *   20%  → #79cfe2 (green)
 *   50%  → #d4b273 (amber)
 *   80%  → #fc5a49 (red-orange)
 *   100% → #cb7768 (red)
 *
 * @param value - Cloud coverage 0-100.
 * @param alpha - Base alpha (0-1), scaled by the value itself so low coverage
 *                is more transparent.
 * @returns CSS rgba() string.
 */
export function cloudValueToColor(value: number, alpha = 0.5): string {
  const v = Math.max(0, Math.min(100, value));

  // Colour stops (value → [r, g, b]).
  const stops: Array<{ at: number; rgb: [number, number, number] }> = [
    { at: 0, rgb: [0, 0, 0] },
    { at: 20, rgb: [0x79, 0xcf, 0xe2] },
    { at: 50, rgb: [0xd4, 0xb2, 0x73] },
    { at: 80, rgb: [0xfc, 0x5a, 0x49] },
    { at: 100, rgb: [0xcb, 0x77, 0x68] },
  ];

  // Find the segment containing `v`.
  let lower = stops[0];
  let upper = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (v >= stops[i].at && v <= stops[i + 1].at) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  // Linear interpolation between the two stops.
  const range = upper.at - lower.at;
  const t = range > 0 ? (v - lower.at) / range : 0;
  const r = Math.round(lower.rgb[0] + (upper.rgb[0] - lower.rgb[0]) * t);
  const g = Math.round(lower.rgb[1] + (upper.rgb[1] - lower.rgb[1]) * t);
  const b = Math.round(lower.rgb[2] + (upper.rgb[2] - lower.rgb[2]) * t);

  // Scale alpha by value: 0% → fully transparent, 100% → full alpha.
  const scaledAlpha = alpha * (v / 100);
  return `rgba(${r}, ${g}, ${b}, ${scaledAlpha.toFixed(3)})`;
}
