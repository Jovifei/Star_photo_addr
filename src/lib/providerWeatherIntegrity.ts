export const PROVIDER_VALIDATION_VERSION = "open-meteo-hourly-v1";

/** Open-Meteo values are accepted in their declared units, never relabeled or clamped. */
export function providerFieldRule(field: string): { unit: string; min: number; max?: number } | null {
  if (/^(cloud_cover(?:_(?:low|mid|high|\d+hPa))?|relative_humidity_(?:2m|\d+hPa)|precipitation_probability)$/.test(field)) {
    return { unit: "%", min: 0, max: 100 };
  }
  // Wide Celsius/MSL bounds retain extreme weather and below-ground model levels.
  if (/^(temperature_(?:2m|\d+hPa)|dew_point_2m)$/.test(field)) return { unit: "°C", min: -150, max: 80 };
  if (/^geopotential_height_\d+hPa$/.test(field)) return { unit: "m", min: -1500, max: 50000 };
  if (/^wind_(?:speed|gusts)_10m$/.test(field)) return { unit: "m/s", min: 0 };
  if (field === "wind_direction_10m") return { unit: "°", min: 0, max: 360 };
  if (field === "precipitation") return { unit: "mm", min: 0 };
  if (field === "visibility") return { unit: "m", min: 0 };
  if (field === "weather_code") return { unit: "wmo code", min: 0, max: 99 };
  return null;
}

export function isValidProviderValue(field: string, value: unknown): value is number {
  const rule = providerFieldRule(field);
  return typeof value === "number" && Number.isFinite(value) && Boolean(rule) &&
    value >= rule!.min && (rule!.max === undefined || value <= rule!.max);
}

/** Validate each supplied known field; callers separately require their score inputs. */
export function validateProviderHourlyFields(hourly: Record<string, unknown>, units: unknown): void {
  const declared = units && typeof units === "object" ? units as Record<string, unknown> : {};
  const length = Array.isArray(hourly.time) ? hourly.time.length : 0;
  const timeUnit = Array.isArray(hourly.time) && hourly.time.every(time => typeof time === "number") ? "unixtime" : "iso8601";
  if (declared.time !== timeUnit) throw new Error(`Open-Meteo time 单位缺失或错误，应为 ${timeUnit}`);
  for (const [field, values] of Object.entries(hourly)) {
    const rule = providerFieldRule(field);
    if (!rule || values === undefined) continue;
    if (declared[field] !== rule.unit) throw new Error(`Open-Meteo ${field} 单位缺失或错误，应为 ${rule.unit}`);
    if (!Array.isArray(values) || values.length !== length || !values.every(value => value === null || isValidProviderValue(field, value))) {
      throw new Error(`Open-Meteo ${field} 数值范围或时间轴无效`);
    }
  }
}
