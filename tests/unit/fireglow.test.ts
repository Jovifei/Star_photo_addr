import { describe, expect, it } from "vitest";
import { buildFireGlowSnapshot, scoreFireGlowSite } from "@/lib/fireglow";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

function recordWithHours(
  hours: Array<{
    time: string;
    low?: number;
    mid?: number;
    high?: number;
    precip?: number;
    visibility?: number;
    gust?: number;
  }>,
): FinderWeatherRecord {
  return {
    hourly: {
      time: hours.map((hour) => hour.time),
      weather_code: hours.map(() => 1),
      cloud_cover: hours.map((hour) => Math.min(100, (hour.low ?? 0) + (hour.mid ?? 0) + (hour.high ?? 0))),
      cloud_cover_low: hours.map((hour) => hour.low ?? 0),
      cloud_cover_mid: hours.map((hour) => hour.mid ?? 0),
      cloud_cover_high: hours.map((hour) => hour.high ?? 0),
      precipitation: hours.map((hour) => hour.precip ?? 0),
      visibility: hours.map((hour) => hour.visibility ?? 20000),
      wind_speed_10m: hours.map(() => 3),
      wind_gusts_10m: hours.map((hour) => hour.gust ?? 6),
      temperature_2m: hours.map(() => 18),
    },
    status: "available",
  };
}

// A site around central China whose evening sun sits near the horizon at 19:00.
const SITE = { id: "test-site", latitude: 30, longitude: 110 };

describe("scoreFireGlowSite", () => {
  it("rewards a broad mid/high deck with thin low cloud at twilight", () => {
    const score = scoreFireGlowSite(
      SITE,
      recordWithHours([
        { time: "2026-08-22T16:00", mid: 45, high: 30, low: 10 },
        { time: "2026-08-22T17:00", mid: 45, high: 30, low: 10 },
        { time: "2026-08-22T18:00", mid: 40, high: 30, low: 8 },
        { time: "2026-08-22T19:00", mid: 40, high: 30, low: 8 },
      ]),
    );
    expect(score.evening.score).not.toBeNull();
    expect(score.evening.score!).toBeGreaterThanOrEqual(52);
    expect(["medium", "strong"]).toContain(score.evening.band);
    expect(score.evening.peakTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it("marks a clear-sky window as missing", () => {
    const score = scoreFireGlowSite(
      SITE,
      recordWithHours([
        { time: "2026-08-22T16:00", mid: 0, high: 0, low: 0 },
        { time: "2026-08-22T19:00", mid: 0, high: 0, low: 0 },
      ]),
    );
    // No deck to light: faint at best, never strong.
    if (score.evening.score != null) {
      expect(score.evening.score).toBeLessThan(40);
    } else {
      expect(score.evening.band).toBe("none");
    }
  });

  it("rejects hours with meaningful precipitation", () => {
    const score = scoreFireGlowSite(
      SITE,
      recordWithHours([
        { time: "2026-08-22T18:00", mid: 40, high: 30, precip: 1.2 },
        { time: "2026-08-22T19:00", mid: 40, high: 30, precip: 0.8 },
      ]),
    );
    expect(score.evening.band).toBe("none");
  });

  it("penalises a thick low deck blocking the lit clouds", () => {
    const open = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", mid: 40, high: 30, low: 5 }]),
    );
    const blocked = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", mid: 40, high: 30, low: 90 }]),
    );
    expect(blocked.evening.score!).toBeLessThan(open.evening.score!);
  });

  it("returns unknown windows when the record is missing", () => {
    const score = scoreFireGlowSite(SITE, undefined);
    expect(score.evening.band).toBe("unknown");
    expect(score.evening.score).toBeNull();
  });

  it("builds a snapshot keyed by curated site ids", () => {
    const snapshot = buildFireGlowSnapshot("2026-08-22", "icon", {
      "2026-08-22": {},
    });
    expect(snapshot.date).toBe("2026-08-22");
    expect(snapshot.model).toBe("icon");
    expect(Object.keys(snapshot.sites).length).toBeGreaterThan(100);
  });
});
