import { afterEach, describe, expect, it, vi } from "vitest";
import { providerUnits } from "../fixtures/providerUnits";
import {
  hasUsablePressureProfile,
  isThermodynamicPressureLevelSample,
  fetchPressureForecastBatch,
  parsePressureForecast,
  PRESSURE_LEVELS,
} from "@/lib/pressure";
import { PRESSURE_PROVIDER_VALIDATOR_VERSION } from "@/lib/pressureProviderIntegrity";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function rawPressure() {
  const time = [
    "2026-10-30T05:00",
    "2026-10-30T06:00",
    "2026-10-30T07:00",
  ];
  const hourly: Record<string, unknown> = { time, temperature_2m: [10, 11, 12] };
  PRESSURE_LEVELS.forEach((level, index) => {
    hourly[`cloud_cover_${level}hPa`] = [72 - index, 73 - index, 74 - index];
    hourly[`relative_humidity_${level}hPa`] = [88 - index, 87 - index, 86 - index];
    hourly[`temperature_${level}hPa`] = [
      9 - index * 1.5,
      8 - index * 1.5,
      7 - index * 1.5,
    ];
    hourly[`geopotential_height_${level}hPa`] = [
      120 + index * 500,
      125 + index * 500,
      130 + index * 500,
    ];
  });
  return {
    elevation: 980,
    latitude: 30.1,
    longitude: 119.2,
    timezone: "Asia/Shanghai",
    utc_offset_seconds: 28800,
    hourly_units: providerUnits(),
    hourly,
  };
}

describe("pressure-specific provider issue classification", () => {
  it.each([
    ["cloud_cover_725hPa", 100],
    ["relative_humidity_775hPa", 100],
  ])("keeps the inclusive 100%% boundary valid for %s", (field, value) => {
    const raw = rawPressure();
    (raw.hourly as Record<string, unknown>)[field] = [value, value, value];

    const parsed = parsePressureForecast(raw, "site", "gfs", true);
    const profile = parsed.profiles["2026-10-30T05:00"]!;
    const pressure = Number(field.match(/(\d+)hPa/)![1]);
    const sample = profile.find((level) => level.pressure === pressure)!;

    expect(sample.providerIssues ?? []).toEqual([]);
    expect(hasUsablePressureProfile(profile)).toBe(true);
  });

  it.each([
    ["cloud_cover_725hPa", 101, "cloudCover"],
    ["relative_humidity_775hPa", 101, "humidity"],
  ])("records %s=%i without clamping or treating it as thermal null", (field, value, normalized) => {
    const raw = rawPressure();
    (raw.hourly as Record<string, unknown>)[field] = [value, value + 1, 80];
    const original = structuredClone(raw);

    const parsed = parsePressureForecast(raw, "site", "gfs", true);
    const polluted = parsed.profiles["2026-10-30T05:00"]!;
    const clean = parsed.profiles["2026-10-30T07:00"]!;
    const pressure = Number(field.match(/(\d+)hPa/)![1]);
    const sample = polluted.find((level) => level.pressure === pressure)!;

    expect(sample).toMatchObject({
      [normalized]: null,
      providerIssues: [{ field, rawValue: value, reason: "out-of-range" }],
    });
    expect(parsed.qualitySchema).toBe("pressure-provider-issues-v1");
    expect(parsed.qualityValidatorVersion).toBe(PRESSURE_PROVIDER_VALIDATOR_VERSION);
    expect(parsed.qualityValidatedAt).toBe(parsed.fetchedAt);
    expect(isThermodynamicPressureLevelSample(sample)).toBe(false);
    expect(hasUsablePressureProfile(polluted)).toBe(false);
    expect(hasUsablePressureProfile(clean)).toBe(true);
    expect(raw).toEqual(original);
  });

  it("keeps malformed units, time axes, and shapes fatal", () => {
    const unit = rawPressure();
    unit.hourly_units.cloud_cover_725hPa = "fraction";
    expect(() => parsePressureForecast(unit, "site", "gfs", true)).toThrow(/单位/);

    const time = rawPressure();
    time.hourly.time = ["2026-10-30T06:00", "2026-10-30T05:00", "2026-10-30T07:00"];
    expect(() => parsePressureForecast(time, "site", "gfs", true)).toThrow(/时间轴/);

    const shape = rawPressure();
    shape.hourly.cloud_cover_725hPa = [100, 80];
    expect(() => parsePressureForecast(shape, "site", "gfs", true)).toThrow(/数值范围或时间轴/);
  });

  it("keeps an unknown pressure height in the polluted hour", () => {
    const raw = rawPressure();
    raw.hourly.geopotential_height_850hPa = [50_001, 2200, 2200];

    const parsed = parsePressureForecast(raw, "site", "gfs", true);
    const profile = parsed.profiles["2026-10-30T05:00"]!;
    const sample = profile.find((level) => level.pressure === 850)!;

    expect(sample.heightMsl).toBeNull();
    expect(sample.providerIssues).toEqual([{
      field: "geopotential_height_850hPa",
      rawValue: 50_001,
      reason: "out-of-range",
    }]);
    expect(hasUsablePressureProfile(profile)).toBe(false);
  });

  it("retains a clean peer while one batch site carries an isolated issue", async () => {
    const polluted = rawPressure();
    polluted.hourly.cloud_cover_725hPa = [101, 80, 80];
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json([polluted, rawPressure()])));

    const result = await fetchPressureForecastBatch(
      [
        { id: "polluted", latitude: 30.1, longitude: 119.2 },
        { id: "clean", latitude: 30.2, longitude: 119.3 },
      ],
      "2026-10-30",
      undefined,
      "gfs",
    );

    expect(result.errors.polluted).toBeUndefined();
    expect(result.errors.clean).toBeUndefined();
    expect(result.data.polluted?.profiles["2026-10-30T05:00"]?.find(
      (level) => level.pressure === 725,
    )?.providerIssues).toEqual([{
      field: "cloud_cover_725hPa",
      rawValue: 101,
      reason: "out-of-range",
    }]);
    expect(result.data.clean).toBeDefined();
  });
});
