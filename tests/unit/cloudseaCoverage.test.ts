import { describe, expect, it } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { buildCloudSeaSnapshot, hasCompleteCloudSeaCoverage } from "@/lib/cloudsea";

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
});
