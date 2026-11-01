import { providerFieldRule } from "./providerWeatherIntegrity";
import { PRESSURE_LEVELS } from "./pressureLevels";

export const PRESSURE_PROVIDER_QUALITY_SCHEMA =
  "pressure-provider-issues-v1" as const;

/** Identifies the validator implementation that produced quality evidence. */
export const PRESSURE_PROVIDER_VALIDATOR_VERSION =
  "pressure-validator-v1" as const;

export interface PressureLevelProviderIssue {
  field: string;
  rawValue: number;
  reason: "out-of-range";
}

export interface ClassifiedPressureFields {
  fields: Record<string, Array<number | null>>;
  issuesByIndex: Map<number, PressureLevelProviderIssue[]>;
}

const PRESSURE_FIELDS = PRESSURE_LEVELS.flatMap(level => [
  `cloud_cover_${level}hPa`,
  `relative_humidity_${level}hPa`,
  `temperature_${level}hPa`,
  `geopotential_height_${level}hPa`,
]);

/**
 * Pressure values are classified separately from shared surface validation.
 * Shape and declaration faults stay fatal; finite out-of-range values remain
 * visible as issues on the affected hour and level.
 */
export function classifyPressureProviderFields(
  hourly: Record<string, unknown>,
  units: unknown,
): ClassifiedPressureFields {
  const declared = units && typeof units === "object"
    ? units as Record<string, unknown>
    : {};
  const length = Array.isArray(hourly.time) ? hourly.time.length : 0;
  const fields: Record<string, Array<number | null>> = {};
  const issuesByIndex = new Map<number, PressureLevelProviderIssue[]>();

  for (const field of PRESSURE_FIELDS) {
    const values = hourly[field];
    if (values === undefined) continue;
    const rule = providerFieldRule(field);
    if (!rule || declared[field] !== rule.unit) {
      throw new Error(`Open-Meteo ${field} 单位缺失或错误，应为 ${rule?.unit ?? "已知单位"}`);
    }
    if (
      !Array.isArray(values) ||
      values.length !== length ||
      !values.every(value =>
        value === null ||
        (typeof value === "number" && Number.isFinite(value))
      )
    ) {
      throw new Error(`Open-Meteo ${field} 数值范围或时间轴无效`);
    }

    fields[field] = values.map((value, index) => {
      if (value === null) return null;
      if (value >= rule.min && (rule.max === undefined || value <= rule.max)) {
        return value;
      }
      const issues = issuesByIndex.get(index) ?? [];
      issues.push({ field, rawValue: value, reason: "out-of-range" });
      issuesByIndex.set(index, issues);
      return null;
    });
  }

  return { fields, issuesByIndex };
}
