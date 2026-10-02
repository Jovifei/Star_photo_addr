import { describe, expect, it } from "vitest";
import { projectCandidateNight } from "@/lib/candidateNightEvidence";
import type { ForecastModel, Location, LocationForecast } from "@/lib/types";

const NIGHT = "2026-10-01";
const NOW = Date.now();
const FETCHED_AT = new Date(NOW - 60_000).toISOString();
const LOCATION: Location = {
  id: "shanghai-sample", name: "样例点", latitude: 31.6, longitude: 121.3,
  elevation: null, source: "参考点位",
};

function forecast(model: ForecastModel, visibility: number | null, stale = false): LocationForecast {
  const fetchedAt = FETCHED_AT;
  const metadata = { source: "Open-Meteo" as const, model, fetchedAt, sourceFetchedAt: fetchedAt, stale, units: {} };
  const hourly = Array.from({ length: 10 }, (_, index) => ({
    time: index < 4
      ? `${NIGHT}T${String(20 + index).padStart(2, "0")}:00`
      : `2026-10-02T${String(index - 4).padStart(2, "0")}:00`,
    temperature: 12, humidity: 60, dewPoint: 5, precipitationProbability: 15,
    precipitation: 0, weatherCode: 0, cloudCover: 35, cloudLow: 20, cloudMid: 15,
    cloudHigh: 10, visibility, windSpeed: 3.4, windGust: 4.2,
  }));
  return {
    locationId: LOCATION.id, requestedLatitude: LOCATION.latitude, requestedLongitude: LOCATION.longitude,
    modelLatitude: LOCATION.latitude, modelLongitude: LOCATION.longitude, modelElevation: 20,
    timezone: "Asia/Shanghai", utcOffsetSeconds: 28_800, fetchedAt, metadata, hourly,
  };
}

describe("candidate night evidence", () => {
  it("keeps fresh same-model raw facts and source time while withholding an ICON score for missing visibility", () => {
    const result = projectCandidateNight(forecast("icon", null), LOCATION, NIGHT, 0, "icon", NOW);
    expect(result.evaluation).toBeNull();
    expect(result.statusLabel).toBe("缺能见度");
    expect(result.reason).toContain("能见度 10/10");
    expect(result.metrics.cloudCover).toEqual({ value: 35, validHours: 10, totalHours: 10 });
    expect(result.metrics.precipitationProbability).toEqual({ value: 15, validHours: 10, totalHours: 10 });
    expect(result.metrics.windSpeed).toEqual({ value: 3.4, validHours: 10, totalHours: 10 });
    expect(result.sourceFetchedAt).toBe(FETCHED_AT);
    expect(result.model).toBe("icon");
  });

  it("allows a complete fresh Best Match night to produce a score", () => {
    const result = projectCandidateNight(forecast("best_match", 20_000), LOCATION, NIGHT, 0, "best_match", NOW);
    expect(result.evaluation, result.reason).not.toBeNull();
    expect(result.evaluation?.score).toEqual(expect.any(Number));
    expect(result.blockedFields).toEqual([]);
    expect(result.sourceFetchedAt).toBe(FETCHED_AT);
    expect(result.stale).toBe(false);
  });

  it("keeps stale raw facts visible while withholding the score", () => {
    const result = projectCandidateNight(forecast("best_match", 20_000, true), LOCATION, NIGHT, 0, "best_match", NOW);
    expect(result.evaluation).toBeNull();
    expect(result.reason).toContain("过期");
    expect(result.metrics.cloudCover.value).toBe(35);
    expect(result.sourceFetchedAt).toBe(FETCHED_AT);
    expect(result.stale).toBe(true);
  });
});
