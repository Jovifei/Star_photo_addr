import { describe, expect, it } from "vitest";
import {
  describeSamplePoint,
  formatElevationMeters,
  haversineDistanceKm,
  normalizeElevationMeters,
  rankNearbySites,
} from "@/lib/locationPresentation";
import type { ObservationSnapshot } from "@/lib/types";

describe("location presentation and nearby ranking", () => {
  it("computes stable great-circle distances", () => {
    const distance = haversineDistanceKm(
      { latitude: 30.2741, longitude: 120.1551 },
      { latitude: 31.2304, longitude: 121.4737 },
    );
    expect(distance).toBeGreaterThan(150);
    expect(distance).toBeLessThan(180);
  });

  it("normalizes centimetre-like elevations and rejects impossible values", () => {
    expect(normalizeElevationMeters(149_900)).toBe(1499);
    expect(normalizeElevationMeters(1499.4)).toBe(1499);
    expect(normalizeElevationMeters(2_000_000)).toBeNull();
    expect(formatElevationMeters(null)).toBe("海拔待核验");
  });

  it("gives a map sample a regional label instead of an ambiguous bare name", () => {
    const label = describeSamplePoint(30.47, 119.6);
    expect(label).toContain("附近取样点");
    expect(label).not.toBe("取样点");
  });

  it("filters by radius and ranks scored sites before nearer unscored sites", () => {
    const broad = rankNearbySites(
      { latitude: 30.47, longitude: 119.6 },
      200,
      null,
      20,
    );
    expect(broad.length).toBeGreaterThan(0);
    const target = broad[0]!;
    const snapshot: ObservationSnapshot = {
      date: "2026-08-22",
      days: 1,
      model: "icon",
      generatedAt: new Date().toISOString(),
      source: "test",
      stale: false,
      sites: Object.fromEntries(
        broad.map((entry) => [
          entry.site.id,
          [
            {
              score: entry.site.id === target.site.id ? 95 : 60,
              band:
                entry.site.id === target.site.id ? "priority" : "watch",
              cloud: 20,
              darkness: 80,
              weatherRisk: 80,
              bestWindow: null,
              blockers: [],
              confidence: "high",
              validHours: 8,
            },
          ],
        ]),
      ),
    };
    const ranked = rankNearbySites(
      { latitude: 30.47, longitude: 119.6 },
      200,
      snapshot,
      20,
    );
    expect(ranked[0]?.site.id).toBe(target.site.id);
    expect(
      rankNearbySites(
        { latitude: 30.47, longitude: 119.6 },
        1,
        snapshot,
      ).every((entry) => entry.distanceKm <= 1),
    ).toBe(true);
  });
});
