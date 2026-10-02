import { afterEach, describe, expect, it, vi } from "vitest";
import { dataAgeMs, effectiveCloudForScore, forecastTrustIssue, MAX_FORECAST_AGE_MS, missingNightInputs, missingWeatherInputs, OBSERVATION_INTEGRITY_VERSION, sanitizeObservationSnapshot, scoreCoreWeather, usableDiskForecast, type IntegritySnapshot } from "@/lib/forecastIntegrity";
import { scoreObservingSiteAtTime, snapshotScoreAtTime } from "@/lib/observingSites";
import { evaluateNight } from "@/lib/scoring";
import type { HourWeather, LocationForecast, ObservingSite, RecommendationScore } from "@/lib/types";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

const NOW = Date.parse("2026-09-13T08:00:00Z");
const AT = new Date(NOW).toISOString();
function hour(time = "2026-09-13T21:00"): HourWeather {
  return { time, cloudCover: 8, cloudLow: 0, cloudMid: 3, cloudHigh: 4, precipitation: 0,
    windSpeed: 1, windGust: 2, visibility: 20000, weatherCode: 0, temperature: 15, humidity: 60, dewPoint: 8, precipitationProbability: 0 };
}
function forecast(): LocationForecast {
  return { locationId: "test", modelLatitude: 30.182, modelLongitude: 108.882, modelElevation: 1402,
    timezone: "Asia/Shanghai", utcOffsetSeconds: 28800, fetchedAt: AT,
    metadata: { source: "Open-Meteo", model: "icon", fetchedAt: AT, stale: false, units: {} }, hourly: [hour()] };
}
const SCORE: RecommendationScore = { score: 94, band: "priority", cloud: 8, darkness: null, weatherRisk: 100,
  bestWindow: "21:00", blockers: [], confidence: "high", validHours: 1 };
function snapshot(): IntegritySnapshot {
  return { date: "2026-09-13", days: 1, model: "icon", generatedAt: AT, sourceFetchedAt: AT,
    integrityVersion: OBSERVATION_INTEGRITY_VERSION, source: "Open-Meteo", stale: false,
    sites: { test: [SCORE] }, focusTime: "2026-09-13T21:00", focusScores: { test: SCORE } };
}
const SITE: ObservingSite = { id: "test", name: "测试", province: "湖北", area: "利川", latitude: 30.182, longitude: 108.882, altitude: 1681, bortle: 2 };
function record(): FinderWeatherRecord {
  return { status: "available", fetchedAt: AT, model: "icon", timezone: "Asia/Shanghai", utcOffsetSeconds: 28_800, hourly: { time: ["2026-09-13T21:00"], relative_humidity_2m: [60], dew_point_2m: [8], precipitation_probability: [0], cloud_cover: [8], cloud_cover_low: [0], cloud_cover_mid: [3], cloud_cover_high: [4],
    precipitation: [0], wind_speed_10m: [1], wind_gusts_10m: [2], visibility: [20000], weather_code: [0], temperature_2m: [15] } };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("P0 original timestamps and stale scores", () => {
  it("accepts the exact retention boundary but rejects 6h+1ms, 7 days, missing and future timestamps", () => {
    const value = forecast();
    for (const age of [MAX_FORECAST_AGE_MS, MAX_FORECAST_AGE_MS + 1, 7 * 86400000]) {
      value.fetchedAt = new Date(NOW - age).toISOString();
      value.metadata!.fetchedAt = value.fetchedAt;
      expect(usableDiskForecast({ locations: [value], metadata: value.metadata }, "icon", 1, MAX_FORECAST_AGE_MS, NOW)).toBe(age <= MAX_FORECAST_AGE_MS);
    }
    value.fetchedAt = "";
    expect(usableDiskForecast({ locations: [value] }, "icon", 1, MAX_FORECAST_AGE_MS, NOW)).toBe(false);
    expect(dataAgeMs("2026-09-13T12:00:00Z", NOW)).toBe(Infinity);
    expect(dataAgeMs("2026-09-13T08:00:00", NOW)).toBe(Infinity);
  });
  it("cannot hide an old per-location timestamp behind fresh envelope metadata", () => {
    const value = forecast(); value.fetchedAt = "2026-09-01T00:00:00Z";
    expect(usableDiskForecast({ locations: [value], metadata: forecast().metadata }, "icon", 1, MAX_FORECAST_AGE_MS, NOW)).toBe(false);
  });
  it("rejects malformed files, missing model metadata, wrong model and wrong count", () => {
    for (const value of [null, {}, { locations: null }, { locations: [null] }, { locations: [{ ...forecast(), metadata: undefined }] }]) {
      expect(usableDiskForecast(value, "icon", 1, MAX_FORECAST_AGE_MS, NOW)).toBe(false);
    }
    expect(usableDiskForecast({ locations: [forecast()] }, "gfs", 1, MAX_FORECAST_AGE_MS, NOW)).toBe(false);
    expect(usableDiskForecast({ locations: [forecast()] }, "icon", 2, MAX_FORECAST_AGE_MS, NOW)).toBe(false);
  });
  it("withholds both focus and nightly 94 from a stale snapshot without mutating raw evidence", () => {
    const input = { ...snapshot(), stale: true };
    const safe = sanitizeObservationSnapshot(input, NOW);
    expect(safe.focusScores!.test.score).toBeNull();
    expect(safe.sites.test[0].band).toBe("unknown");
    expect(safe.sites.test[0].confidence).toBe("unknown");
    expect(safe.sites.test[0].cloud).toBe(8);
    expect(input.focusScores!.test.score).toBe(94);
    expect(safe.generatedAt).toBe(AT);
  });
  it("rejects recently generated legacy scoring caches and old source hidden by regenerated snapshot time", () => {
    expect(sanitizeObservationSnapshot({ ...snapshot(), integrityVersion: undefined } as IntegritySnapshot, NOW).sites.test[0].score).toBeNull();
    expect(sanitizeObservationSnapshot({ ...snapshot(), sourceFetchedAt: "2026-09-01T00:00:00Z" } as IntegritySnapshot, NOW).sites.test[0].score).toBeNull();
  });
  it("blocks stale forecasts in the shared night scorer and exact-time snapshot getter", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const value = forecast(); value.metadata!.stale = true;
    expect(forecastTrustIssue(value)).not.toBeNull();
    expect(evaluateNight(value, { ...SITE, elevation: SITE.altitude, source: "参考点位" }, "2026-09-13")).toBeNull();
    expect(snapshotScoreAtTime({ ...snapshot(), stale: true }, "test")!.score).toBeNull();
  });
});
describe("P0 layer-aware scoring gate", () => {
  it("uses the same canonical hour score for the map and detail views", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const times = Array.from({ length: 10 }, (_, index) => {
      const utc = Date.parse("2026-09-13T20:00:00Z") + index * 3_600_000;
      return new Date(utc).toISOString().slice(0, 16);
    });
    const values = (value: number) => times.map(() => value);
    const weather = {
      time: times,
      relative_humidity_2m: values(60), dew_point_2m: values(8), precipitation_probability: values(0),
      weather_code: values(0), cloud_cover: values(8), cloud_cover_low: values(0), cloud_cover_mid: values(3), cloud_cover_high: values(4),
      precipitation: values(0), visibility: values(20_000), wind_speed_10m: values(1), wind_gusts_10m: values(2), temperature_2m: values(15),
    };
    const finderRecord: FinderWeatherRecord = { status: "available", fetchedAt: AT, model: "icon", timezone: "Asia/Shanghai", utcOffsetSeconds: 28_800, hourly: weather };
    const detail = evaluateNight({ ...forecast(), hourly: times.map((time) => hour(time)) }, { ...SITE, elevation: SITE.altitude, source: "参考点位" }, "2026-09-13");
    const map = scoreObservingSiteAtTime(SITE, finderRecord, times[0]!, "icon");
    const detailHour = detail?.hours.find((item) => item.time === times[0]);
    expect(detailHour?.score).toBe(map.score);
    expect(detailHour?.blockers).toEqual(map.blockers);
    expect(map).toMatchObject({ scoreBasis: "selected-forecast-hour", scoreTime: times[0], aggregation: "single-hour" });
    expect(detail).toMatchObject({ scoreBasis: "night-best-contiguous-window", aggregation: "best-contiguous-3h" });
  });

  it("uses a conservative maximum, NOT addition of overlapping cloud layers", () => {
    expect(effectiveCloudForScore({ ...hour(), cloudCover: 8, cloudLow: 61, cloudMid: 40, cloudHigh: 30 })).toBe(61);
    expect(effectiveCloudForScore({ ...hour(), cloudLow: null })).toBeNull();
    expect(effectiveCloudForScore({ ...hour(), cloudMid: 101 })).toBeNull();
  });
  it("does not return 94/high confidence when low or mid cloud is substantial", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    for (const field of ["cloud_cover_low", "cloud_cover_mid", "cloud_cover_high"] as const) {
      const value = record(); value.hourly![field] = [61];
      const score = scoreObservingSiteAtTime(SITE, value, value.hourly!.time[0]);
      expect(score.score).toBeLessThan(70);
      expect(score.band).toBe("not-recommended");
      expect(score.confidence).not.toBe("high");
      expect(score.cloud).toBe(8); // Preserve actual provider TOTAL, not the conservative input.
    }
  });
  it("missing clouds, precipitation, wind, gust, visibility or code are not replaced by clear defaults", () => {
    for (const field of ["cloudCover", "cloudLow", "cloudMid", "cloudHigh", "precipitation", "windSpeed", "windGust", "visibility", "weatherCode"] as const) {
      expect(missingWeatherInputs({ ...hour(), [field]: null }).length).toBeGreaterThan(0);
    }
    expect(missingNightInputs({ ...hour(), dewPoint: null })).toContain("露点");
  });
  it("does not publish a core score when any canonical scoring field is missing", () => {
    for (const field of ["temperature", "humidity", "dewPoint", "precipitationProbability"] as const) {
      expect(scoreCoreWeather({ ...hour(), [field]: null })).toBeNull();
    }
  });
  it("stale/missing records and incomplete exact-hour fields have no score", () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const value = record(); value.hourly!.cloud_cover_low = [null];
    expect(scoreObservingSiteAtTime(SITE, value, value.hourly!.time[0]).score).toBeNull();
    expect(scoreObservingSiteAtTime(SITE, { ...record(), status: "stale" }, "2026-09-13T21:00").score).toBeNull();
  });
});
