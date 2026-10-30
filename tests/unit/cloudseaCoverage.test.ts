import { describe, expect, it } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { buildCloudSeaSnapshot, hasCompleteCloudSeaCoverage } from "@/lib/cloudsea";
import {
  PRESSURE_LEVELS,
  type PressureForecastResponse,
  type PressureLevelSample,
} from "@/lib/pressure";

const windowTimes = [5, 6, 7, 8, 17, 18, 19].map(hour =>
  `2026-10-22T${String(hour).padStart(2, "0")}:00`,
);

function pressureSample(
  pressure: number,
  index: number,
): PressureLevelSample {
  return {
    pressure,
    cloudCover: pressure === 950 || pressure === 925 ? 82 : 8,
    humidity: pressure === 950 || pressure === 925 ? 96 : 55,
    temperature: 10 - index,
    heightMsl: 120 + index * 500,
  };
}

const cleanProfile = PRESSURE_LEVELS.map(pressureSample);

function pressureFor(locationId: string): PressureForecastResponse {
  return {
    locationId,
    modelElevation: 980,
    nativeGridElevationM: 980,
    verticalReference: "native-grid-v2",
    qualifiedPressureLevels: PRESSURE_LEVELS,
    timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28800,
    fetchedAt: "2026-10-22T00:00:00Z",
    source: "Open-Meteo",
    model: "gfs",
    stale: false,
    qualitySchema: "pressure-provider-issues-v1",
    qualityValidatorVersion: "pressure-validator-v1",
    qualityValidatedAt: "2026-10-22T00:00:00Z",
    hourly: windowTimes.map(time => ({ time, temperature: 10 })),
    profiles: Object.fromEntries(windowTimes.map(time => [
      time,
      cleanProfile.map(sample => ({ ...sample })),
    ])),
  };
}

describe("CloudSea source coverage cache gate", () => {
  const siteCount = CLOUD_SEA_SITES.length;
  const fullCoverage = {
    status: "available" as const,
    availableSites: siteCount,
    totalSites: siteCount,
    failedSites: 0,
  };

  it("requires the full configured site count and internally consistent integer counts", () => {
    expect(hasCompleteCloudSeaCoverage(fullCoverage, siteCount)).toBe(true);
    expect(hasCompleteCloudSeaCoverage({
      ...fullCoverage,
      availableSites: 1,
      totalSites: 1,
    }, siteCount)).toBe(false);
    expect(hasCompleteCloudSeaCoverage({
      ...fullCoverage,
      availableSites: undefined as unknown as number,
    }, siteCount)).toBe(false);
    expect(hasCompleteCloudSeaCoverage({
      ...fullCoverage,
      failedSites: 1,
    }, siteCount)).toBe(false);
    expect(hasCompleteCloudSeaCoverage(undefined, siteCount)).toBe(false);
  });

  it("does not report full surface coverage when every window is missing most of its hours", () => {
    const time = ["2026-10-22T05:00", "2026-10-22T17:00"];
    const hourly = {
      time,
      cloud_cover_low: [10, 10], cloud_cover_mid: [0, 0], cloud_cover_high: [0, 0],
      relative_humidity_2m: [90, 90], wind_speed_10m: [1, 1], precipitation: [0, 0],
    };
    const snapshot = buildCloudSeaSnapshot("2026-10-22", "icon", {
      "2026-10-22": Object.fromEntries(CLOUD_SEA_SITES.map(site => [site.id, hourly])),
    });
    expect(snapshot.surface?.availableSites).toBe(0);
    expect(hasCompleteCloudSeaCoverage(snapshot.surface, siteCount)).toBe(false);
    expect(snapshot.sites[CLOUD_SEA_SITES[0]!.id]?.morning.coverage).toEqual({
      expectedHours: 4, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 0,
    });
  });

  it("retains full surface coverage for complete morning and evening windows without pressure", () => {
    const time = [5, 6, 7, 8, 17, 18, 19].map(hour =>
      `2026-10-22T${String(hour).padStart(2, "0")}:00`,
    );
    const hourly = {
      time,
      cloud_cover_low: time.map(() => 10), cloud_cover_mid: time.map(() => 0),
      cloud_cover_high: time.map(() => 0), relative_humidity_2m: time.map(() => 90),
      wind_speed_10m: time.map(() => 1), precipitation: time.map(() => 0),
    };
    const snapshot = buildCloudSeaSnapshot("2026-10-22", "icon", {
      "2026-10-22": Object.fromEntries(CLOUD_SEA_SITES.map(site => [site.id, hourly])),
    });
    expect(hasCompleteCloudSeaCoverage(snapshot.surface, siteCount)).toBe(true);
    expect(snapshot.pressure?.status).toBe("unavailable");
  });

  it("distinguishes received, partial, and complete pressure sites", () => {
    const hourly = {
      time: windowTimes,
      cloud_cover_low: windowTimes.map(() => 90),
      cloud_cover_mid: windowTimes.map(() => 5),
      cloud_cover_high: windowTimes.map(() => 5),
      relative_humidity_2m: windowTimes.map(() => 95),
      wind_speed_10m: windowTimes.map(() => 2),
      precipitation: windowTimes.map(() => 0),
    };
    const pressure = Object.fromEntries(
      CLOUD_SEA_SITES.map(site => [site.id, pressureFor(site.id)]),
    );
    const pollutedSite = CLOUD_SEA_SITES[0]!;
    pressure[pollutedSite.id]!.profiles[windowTimes[0]!] =
      cleanProfile.map(sample => sample.pressure === 850
        ? {
            ...sample,
            cloudCover: null,
            providerIssues: [{
              field: "cloud_cover_850hPa",
              rawValue: 101,
              reason: "out-of-range" as const,
            }],
          }
        : sample);

    const snapshot = buildCloudSeaSnapshot(
      "2026-10-22",
      "gfs",
      { "2026-10-22": Object.fromEntries(CLOUD_SEA_SITES.map(site => [site.id, hourly])) },
      pressure,
    );

    expect(snapshot.pressure).toMatchObject({
      status: "partial",
      receivedSites: siteCount,
      availableSites: siteCount - 1,
      partialSites: 1,
      totalSites: siteCount,
      failedSites: 1,
    });
    expect(snapshot.sites[pollutedSite.id]!.morning.pressureStatus).toBe("partial");
    expect(hasCompleteCloudSeaCoverage(snapshot.pressure, siteCount)).toBe(false);
  });
});
