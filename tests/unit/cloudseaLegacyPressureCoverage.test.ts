import { describe, expect, it } from "vitest";
import {
  CLOUD_SEA_EMPTY_WINDOW,
  CLOUD_SEA_SCORE_VERSION,
  presentCloudSeaSnapshot,
  type CloudSeaSnapshot,
  type CloudSeaWindowScore,
} from "@/lib/cloudsea";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";

function window(
  expectedHours: number,
  pressureHours: number,
): CloudSeaWindowScore {
  return {
    ...CLOUD_SEA_EMPTY_WINDOW,
    score: 50,
    peakScore: 50,
    coverage: {
      expectedHours,
      surfaceValidHours: expectedHours,
      scoreableHours: expectedHours,
      pressureHours,
    },
    pressureStatus: pressureHours === expectedHours ? "available" : "partial",
  };
}

describe("legacy cloud-sea pressure coverage presentation", () => {
  it("derives complete sites from retained windows instead of trusting legacy received counts", () => {
    const sites = Object.fromEntries(CLOUD_SEA_SITES.map((site, index) => [
      site.id,
      index === 0
        ? { morning: window(4, 3), evening: window(3, 3) }
        : { morning: window(4, 4), evening: window(3, 3) },
    ]));
    const snapshot: CloudSeaSnapshot = {
      scoreVersion: CLOUD_SEA_SCORE_VERSION,
      date: "2026-10-30",
      model: "gfs",
      generatedAt: "2026-10-30T00:00:00Z",
      source: "legacy fixture",
      stale: false,
      pressure: {
        status: "available",
        availableSites: CLOUD_SEA_SITES.length,
        totalSites: CLOUD_SEA_SITES.length,
        failedSites: 0,
      },
      sites,
    };

    const presented = presentCloudSeaSnapshot(snapshot);

    expect(presented.pressure).toMatchObject({
      status: "partial",
      receivedSites: CLOUD_SEA_SITES.length,
      availableSites: CLOUD_SEA_SITES.length - 1,
      partialSites: 1,
      totalSites: CLOUD_SEA_SITES.length,
      failedSites: 1,
    });
    expect(presented.sites[CLOUD_SEA_SITES[0]!.id]!.morning).toMatchObject({
      score: 50,
      peakScore: 50,
      pressureStatus: "partial",
    });
    expect(presented.pressureQualitySchema).toBeUndefined();
    expect(presented.pressureQualityValidatorVersion).toBeUndefined();
  });

  it("does not infer pressure evidence from a window that lacks pressureStatus", () => {
    const total = CLOUD_SEA_SITES.length;
    const withoutStatus = (expectedHours: number): CloudSeaWindowScore => {
      const clone = {
        ...CLOUD_SEA_EMPTY_WINDOW,
        score: null,
        coverage: {
          expectedHours,
          surfaceValidHours: expectedHours,
          scoreableHours: 0,
          pressureHours: 0,
        },
      } as Record<string, unknown>;
      // A legacy payload can omit the field entirely; absence is not evidence.
      delete clone.pressureStatus;
      return clone as unknown as CloudSeaWindowScore;
    };
    const sites = Object.fromEntries(CLOUD_SEA_SITES.map((site, index) => [
      site.id,
      index === 0
        ? { morning: withoutStatus(4), evening: withoutStatus(3) }
        : { morning: window(4, 4), evening: window(3, 3) },
    ]));
    const snapshot: CloudSeaSnapshot = {
      scoreVersion: CLOUD_SEA_SCORE_VERSION,
      date: "2026-10-31",
      model: "gfs",
      generatedAt: "2026-10-31T00:00:00Z",
      source: "legacy fixture",
      stale: false,
      pressure: {
        status: "available",
        availableSites: total,
        totalSites: total,
        failedSites: 0,
      },
      sites,
    };

    const presented = presentCloudSeaSnapshot(snapshot);

    expect(presented.pressure).toMatchObject({
      status: "partial",
      receivedSites: total - 1,
      availableSites: total - 1,
      partialSites: 0,
      totalSites: total,
      failedSites: 1,
    });
    expect(presented.pressureQualitySchema).toBeUndefined();
  });

  it("keeps qualified pressure evidence intact without downgrading", () => {
    const total = CLOUD_SEA_SITES.length;
    const sites = Object.fromEntries(CLOUD_SEA_SITES.map(site => [
      site.id,
      { morning: window(4, 4), evening: window(3, 3) },
    ]));
    const snapshot: CloudSeaSnapshot = {
      scoreVersion: CLOUD_SEA_SCORE_VERSION,
      date: "2026-10-31",
      model: "gfs",
      generatedAt: "2026-10-31T00:00:00Z",
      source: "qualified fixture",
      stale: false,
      pressureQualitySchema: "pressure-provider-issues-v1",
      pressureQualityValidatorVersion: "pressure-validator-v1",
      pressure: {
        status: "available",
        receivedSites: total,
        availableSites: total,
        partialSites: 0,
        totalSites: total,
        failedSites: 0,
      },
      sites,
    };

    const presented = presentCloudSeaSnapshot(snapshot);

    expect(presented.pressure).toMatchObject({
      status: "available",
      receivedSites: total,
      availableSites: total,
      partialSites: 0,
      failedSites: 0,
    });
    expect(presented.pressureQualitySchema).toBe("pressure-provider-issues-v1");
    expect(presented.pressureQualityValidatorVersion).toBe("pressure-validator-v1");
  });
});
