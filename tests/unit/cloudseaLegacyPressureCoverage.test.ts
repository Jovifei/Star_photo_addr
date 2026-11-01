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
  it.each([false, true])("does not count complete hours without a pressure status (qualified: %s)", qualified => {
    const morning = window(3, 3);
    const evening = window(3, 3);
    delete (morning as Partial<CloudSeaWindowScore>).pressureStatus;
    delete (evening as Partial<CloudSeaWindowScore>).pressureStatus;
    const snapshot: CloudSeaSnapshot = {
      scoreVersion: CLOUD_SEA_SCORE_VERSION,
      date: "2026-11-01",
      model: "gfs",
      generatedAt: "2026-11-01T00:00:00Z",
      source: "fixture",
      stale: false,
      ...(qualified ? {
        pressureQualitySchema: "pressure-provider-issues-v1" as const,
        pressureQualityValidatorVersion: "pressure-validator-v1" as const,
      } : {}),
      pressure: { status: "available", availableSites: 1, totalSites: 1, failedSites: 0 },
      sites: { summit: { morning, evening } },
    };
    const original = structuredClone(snapshot);

    const presented = presentCloudSeaSnapshot(snapshot);

    expect(presented.pressure).toMatchObject({ receivedSites: 0, availableSites: 0, partialSites: 0, failedSites: 1 });
    expect(presented.pressure?.status).not.toBe("available");
    expect(presented.sites.summit.morning.score).toBe(50);
    expect(snapshot).toEqual(original);
  });

  it.each(["partial", "unavailable"] as const)("does not count %s windows as complete even when hours match", status => {
    const morning = { ...window(3, 3), pressureStatus: status };
    const evening = { ...window(3, 3), pressureStatus: status };
    const snapshot: CloudSeaSnapshot = {
      scoreVersion: CLOUD_SEA_SCORE_VERSION,
      date: "2026-11-01", model: "gfs", generatedAt: "2026-11-01T00:00:00Z", source: "fixture", stale: false,
      pressureQualitySchema: "pressure-provider-issues-v1", pressureQualityValidatorVersion: "pressure-validator-v1",
      pressure: { status: "available", availableSites: 1, totalSites: 1, failedSites: 0 },
      sites: { summit: { morning, evening } },
    };

    const presented = presentCloudSeaSnapshot(snapshot);

    expect(presented.pressure?.availableSites).toBe(0);
    expect(presented.pressure?.status).not.toBe("available");
  });

  it.each([
    ["both markers", {}],
    ["schema", { pressureQualityValidatorVersion: "pressure-validator-v1" as const }],
    ["validator", { pressureQualitySchema: "pressure-provider-issues-v1" as const }],
    ["matching validator", { pressureQualitySchema: "pressure-provider-issues-v1" as const, pressureQualityValidatorVersion: "wrong" as "pressure-validator-v1" }],
  ])("does not promote legacy windows without %s", (_missing, quality) => {
    const snapshot: CloudSeaSnapshot = {
      scoreVersion: CLOUD_SEA_SCORE_VERSION,
      date: "2026-11-01", model: "gfs", generatedAt: "2026-11-01T00:00:00Z", source: "fixture", stale: false,
      ...quality,
      pressure: { status: "available", availableSites: 1, totalSites: 1, failedSites: 0 },
      sites: { summit: { morning: window(3, 3), evening: window(3, 3) } },
    };

    const presented = presentCloudSeaSnapshot(snapshot);

    expect(presented.pressure).toMatchObject({ receivedSites: 1, availableSites: 0, partialSites: 1, failedSites: 1 });
    expect(presented.pressure?.status).not.toBe("available");
    expect(presented.sites.summit.morning.score).toBe(50);
    expect(presented.pressureQualitySchema).toBe(snapshot.pressureQualitySchema);
    expect(presented.pressureQualityValidatorVersion).toBe(snapshot.pressureQualityValidatorVersion);
  });

  it("retains legacy scores without promoting unqualified windows to complete", () => {
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
      status: "unavailable",
      receivedSites: CLOUD_SEA_SITES.length,
      availableSites: 0,
      partialSites: CLOUD_SEA_SITES.length,
      totalSites: CLOUD_SEA_SITES.length,
      failedSites: CLOUD_SEA_SITES.length,
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
      pressureQualitySchema: "pressure-provider-issues-v1",
      pressureQualityValidatorVersion: "pressure-validator-v1",
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
    expect(presented.pressureQualitySchema).toBe("pressure-provider-issues-v1");
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
