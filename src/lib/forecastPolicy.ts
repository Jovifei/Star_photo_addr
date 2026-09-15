/** Default for new observing sessions only. Explicit model choices are preserved. */
export const DEFAULT_SCORING_MODEL = "gfs" as const;
export const FORECAST_MODELS = ["best_match", "icon", "gfs", "aifs"] as const;
export type SupportedForecastModel = (typeof FORECAST_MODELS)[number];

export function isForecastModel(value: unknown): value is SupportedForecastModel {
  return typeof value === "string" && FORECAST_MODELS.some((model) => model === value);
}

/** Same raw fields required by the Finder batch contract; no cross-model filling. */
export const SCORING_REQUIRED_SERIES = [
  ["relative_humidity_2m", "湿度"],
  ["dew_point_2m", "露点"],
  ["precipitation_probability", "降水概率"],
  ["weather_code", "天气代码"],
  ["cloud_cover", "总云"],
  ["cloud_cover_low", "低云"],
  ["cloud_cover_mid", "中云"],
  ["cloud_cover_high", "高云"],
  ["precipitation", "降水"],
  ["visibility", "能见度"],
  ["wind_speed_10m", "风速"],
  ["wind_gusts_10m", "阵风"],
  ["temperature_2m", "温度"],
] as const;

function validNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** A sample probe is capability evidence, not catalogue coverage or accuracy. */
export function missingScoringSeries(hourly: Record<string, unknown> | undefined): string[] {
  const times = hourly?.time;
  if (!Array.isArray(times) || !times.length ||
      !times.every((time) => typeof time === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(time)) ||
      new Set(times).size !== times.length ||
      !times.every((time, index) => index === 0 || time > times[index - 1])) {
    return ["有效且唯一的逐小时时间轴"];
  }
  const missing = SCORING_REQUIRED_SERIES.filter(([field]) => {
    const values = hourly?.[field];
    return !Array.isArray(values) || values.length !== times.length ||
      !values.every((value) => value === null || validNumber(value)) ||
      !values.some(validNumber);
  }).map(([, label]) => label as string);
  if (!missing.length && !times.some((_, index) => SCORING_REQUIRED_SERIES.every(
    ([field]) => validNumber((hourly?.[field] as unknown[])[index]),
  ))) {
    missing.push("同一时次的完整评分字段");
  }
  return missing;
}

const NORMALIZED_SCORING_FIELDS: Record<(typeof SCORING_REQUIRED_SERIES)[number][0], string> = {
  relative_humidity_2m: "humidity", dew_point_2m: "dewPoint",
  precipitation_probability: "precipitationProbability", weather_code: "weatherCode",
  cloud_cover: "cloudCover", cloud_cover_low: "cloudLow", cloud_cover_mid: "cloudMid",
  cloud_cover_high: "cloudHigh", precipitation: "precipitation", visibility: "visibility",
  wind_speed_10m: "windSpeed", wind_gusts_10m: "windGust", temperature_2m: "temperature",
};

/** Use the same capability fields in the timeline as in the raw Finder probe. */
export function missingScoringHour(hour: unknown): string[] {
  if (!hour || typeof hour !== "object") return ["所选时次"];
  const source = hour as Record<string, unknown>;
  return missingScoringSeries({
    time: [source.time],
    ...Object.fromEntries(SCORING_REQUIRED_SERIES.map(([field]) =>
      [field, [source[NORMALIZED_SCORING_FIELDS[field]] ?? null]])),
  });
}
