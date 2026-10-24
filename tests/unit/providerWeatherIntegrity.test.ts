import { describe, expect, it } from "vitest";
import { validateRawForecast } from "@/lib/forecast";
import { validateFinderRawForecast } from "@/lib/stargazingFinderWeather";
import { hasUsablePressureProfile, isCompletePressureLevelSample, parsePressureForecast, PRESSURE_LEVELS } from "@/lib/pressure";

function surface() {
  const hourly = {
    time: [Date.parse("2026-10-23T00:00:00Z") / 1000],
    temperature_2m: [10], dew_point_2m: [5], relative_humidity_2m: [70],
    precipitation_probability: [0], precipitation: [0], weather_code: [0],
    cloud_cover: [10], cloud_cover_low: [10], cloud_cover_mid: [0], cloud_cover_high: [0],
    visibility: [20000], wind_speed_10m: [1] as Array<number | null>, wind_gusts_10m: [2], wind_direction_10m: [90],
  };
  const hourly_units: Record<string, string> = {
    time: "unixtime",
    temperature_2m: "°C", dew_point_2m: "°C", relative_humidity_2m: "%", precipitation_probability: "%",
    precipitation: "mm", weather_code: "wmo code", cloud_cover: "%", cloud_cover_low: "%", cloud_cover_mid: "%",
    cloud_cover_high: "%", visibility: "m", wind_speed_10m: "m/s", wind_gusts_10m: "m/s", wind_direction_10m: "°",
  };
  return { latitude: 30, longitude: 120, elevation: 100, timezone: "Asia/Shanghai", utc_offset_seconds: 28800, hourly, hourly_units };
}

describe("provider data integrity before scoring", () => {
  it.each([undefined, "iso8601"])("rejects absent/conflicting epoch time units (%s)", unit => {
    const raw = surface();
    if (unit) raw.hourly_units.time = unit;
    else delete raw.hourly_units.time;
    expect(() => validateRawForecast(raw)).toThrow(/单位/);
  });
  it("rejects non-Shanghai Finder clocks instead of parsing them as Beijing time", () => {
    const raw = surface(); raw.hourly_units.time = "iso8601";
    const finder = { ...raw, timezone: "UTC", utc_offset_seconds: 0, hourly: { ...raw.hourly, time: ["2026-10-23T08:00"] } };
    expect(() => validateFinderRawForecast(finder)).toThrow(/时区/);
  });
  it.each([undefined, "km/h"])("rejects missing/conflicting wind units (%s) instead of relabeling them", unit => {
    const raw = surface();
    if (unit) raw.hourly_units.wind_speed_10m = unit;
    else delete raw.hourly_units.wind_speed_10m;
    expect(() => validateRawForecast(raw)).toThrow(/单位/);
  });
  it.each([
    ["cloud_cover_low", 101], ["relative_humidity_2m", 150], ["precipitation", -1],
    ["wind_speed_10m", -1], ["temperature_2m", 280], ["visibility", -1],
  ] as const)("rejects impossible %s=%s", (field, value) => {
    const raw = surface(); raw.hourly[field] = [value];
    expect(() => validateRawForecast(raw)).toThrow(/范围/);
  });
  it("preserves individual missing hours and optional visibility", () => {
    const raw = surface(); raw.hourly.wind_speed_10m = [null];
    expect(() => validateRawForecast(raw)).not.toThrow();
    const finder = { ...raw, hourly_units: { ...raw.hourly_units, time: "iso8601" } as Record<string, string>, hourly: { ...raw.hourly, time: ["2026-10-23T08:00"], wind_speed_10m: [1], visibility: undefined } };
    expect(() => validateFinderRawForecast(finder)).not.toThrow();
  });
  it("rejects bad units and out-of-range cloud in the Fireglow/Finder provider path", () => {
    const raw = surface();
    const finder = { ...raw, hourly_units: { ...raw.hourly_units, time: "iso8601" } as Record<string, string>, hourly: { ...raw.hourly, time: ["2026-10-23T08:00"] } };
    finder.hourly_units.precipitation = "inch";
    expect(() => validateFinderRawForecast(finder)).toThrow(/单位/);
    finder.hourly_units.precipitation = "mm";
    finder.hourly.cloud_cover_low = [999];
    expect(() => validateFinderRawForecast(finder)).toThrow(/范围/);
  });
  it("requires legal unique pressure levels but permits slightly negative below-ground heights", () => {
    const sample = { pressure: 950, cloudCover: 80, humidity: 95, temperature: 5, heightMsl: -50 };
    expect(isCompletePressureLevelSample(sample)).toBe(true);
    expect(isCompletePressureLevelSample({ ...sample, cloudCover: 999 })).toBe(false);
    expect(isCompletePressureLevelSample({ ...sample, temperature: 280 })).toBe(false);
    expect(hasUsablePressureProfile(Array.from({ length: 6 }, () => sample))).toBe(false);
    expect(hasUsablePressureProfile(PRESSURE_LEVELS.slice(0, 6).map(pressure => ({ ...sample, pressure })))).toBe(true);
  });
  it("rejects wrong pressure-height units before publishing a profile", () => {
    const raw = surface();
    const hourly: Record<string, unknown> = { time: raw.hourly.time };
    for (const pressure of PRESSURE_LEVELS) {
      for (const [prefix, value, unit] of [["cloud_cover", 80, "%"], ["relative_humidity", 95, "%"], ["temperature", 5, "°C"], ["geopotential_height", 1000, "m"]] as const) {
        const field = `${prefix}_${pressure}hPa`; hourly[field] = [value]; raw.hourly_units[field] = unit;
      }
    }
    raw.hourly_units.geopotential_height_950hPa = "ft";
    expect(() => parsePressureForecast({ ...raw, hourly }, "site", "icon")).toThrow(/单位/);
  });
});
