import { evaluateNight, statusMeta } from "./scoring";
import { forecastTrustIssue, missingNightInputs } from "./forecastIntegrity";
import { isInNight } from "./nighttime";
import type { ForecastModel, HourWeather, Location, LocationForecast, NightEvaluation } from "./types";

export interface NightMetricSummary {
  value: number | null;
  validHours: number;
  totalHours: number;
}

export interface CandidateNightEvidence {
  evaluation: NightEvaluation | null;
  model: ForecastModel | null;
  sourceFetchedAt: string | null;
  stale: boolean;
  reason: string;
  statusLabel: string;
  blockedFields: Array<{ label: string; missingHours: number; totalHours: number }>;
  nightHourCount: number;
  metrics: {
    cloudCover: NightMetricSummary;
    precipitationProbability: NightMetricSummary;
    windSpeed: NightMetricSummary;
  };
}

function finiteBetween(value: unknown, minimum: number, maximum = Infinity): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function meanSummary(hours: HourWeather[], field: "cloudCover"): NightMetricSummary {
  const values = hours.map((hour) => hour[field]).filter((value): value is number => finiteBetween(value, 0, 100));
  return {
    value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    validHours: values.length,
    totalHours: hours.length,
  };
}

function maxSummary(hours: HourWeather[], field: "precipitationProbability" | "windSpeed", maximum = Infinity): NightMetricSummary {
  const values = hours.map((hour) => hour[field]).filter((value): value is number => finiteBetween(value, 0, maximum));
  return { value: values.length ? Math.max(...values) : null, validHours: values.length, totalHours: hours.length };
}

function collectBlockers(hours: HourWeather[]): CandidateNightEvidence["blockedFields"] {
  const counts = new Map<string, number>();
  for (const hour of hours) {
    for (const label of missingNightInputs(hour)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts].map(([label, missingHours]) => ({ label, missingHours, totalHours: hours.length }));
}

/** Projects useful same-model night facts without changing the fail-closed score gate. */
export function projectCandidateNight(
  forecast: LocationForecast | null | undefined,
  location: Location,
  nightKey: string,
  leadIndex = 0,
  expectedModel?: ForecastModel,
  now = Date.now(),
): CandidateNightEvidence {
  const model = forecast?.metadata?.model ?? null;
  const sourceFetchedAt = forecast?.metadata?.sourceFetchedAt ?? forecast?.fetchedAt ?? null;
  const hours = forecast?.hourly
    .filter((hour) => isInNight(hour.time, nightKey))
    .sort((a, b) => a.time.localeCompare(b.time)) ?? [];
  const metrics = {
    cloudCover: meanSummary(hours, "cloudCover"),
    precipitationProbability: maxSummary(hours, "precipitationProbability", 100),
    windSpeed: maxSummary(hours, "windSpeed"),
  };
  const blockedFields = collectBlockers(hours);
  const trustIssue = forecastTrustIssue(forecast, now, expectedModel);
  const uniqueTimes = new Set(hours.map((hour) => hour.time));
  let reason = trustIssue ?? "";
  let evaluation: NightEvaluation | null = null;

  if (!reason && hours.length < 7) reason = `夜间时次不足（${hours.length}/7）`;
  if (!reason && uniqueTimes.size !== hours.length) reason = "夜间预报时次重复";
  if (!reason && hours.some((hour) => !Number.isFinite(Date.parse(`${hour.time}Z`)))) reason = "夜间预报时次无效";
  if (!reason && blockedFields.length) {
    reason = blockedFields.map(({ label, missingHours, totalHours }) => `缺${label} ${missingHours}/${totalHours}夜间时次`).join("；");
  }
  if (!reason && forecast) evaluation = evaluateNight(forecast, location, nightKey, leadIndex);
  if (!reason && !evaluation) reason = "评分暂不可用，整夜评分条件未满足";

  const statusLabel = evaluation
    ? statusMeta(evaluation.status).label
    : !forecast
      ? "数据不足"
      : /过期|降级|超过 6 小时/.test(reason)
        ? "数据过期"
        : blockedFields.length
          ? `缺${blockedFields[0]!.label}`
          : hours.length < 7
            ? "时次不足"
            : "评分暂缓";

  return {
    evaluation,
    model,
    sourceFetchedAt,
    stale: Boolean(forecast?.metadata?.stale),
    reason: reason || evaluation?.reason || "",
    statusLabel,
    blockedFields,
    nightHourCount: hours.length,
    metrics,
  };
}
