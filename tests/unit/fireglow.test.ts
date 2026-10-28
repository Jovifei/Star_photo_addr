import { describe, expect, it } from "vitest";
import { buildFireGlowSnapshot, isHighFireGlowLevel, probabilityRangeFor, scoreFireGlowSite } from "@/lib/fireglow";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";
import { OBSERVING_SITES } from "@/lib/observingSites";
import { fireGlowSiteQuality } from "@/lib/fireglowQuality";

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
      relative_humidity_2m: hours.map(() => 60),
      dew_point_2m: hours.map(() => 10),
      precipitation_probability: hours.map(() => 0),
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
  it("scores the catalog's western sunset after 20:00", () => {
    const date = "2026-06-21";
    const record = recordWithHours(Array.from({ length: 24 }, (_, hour) => ({
      time: `${date}T${String(hour).padStart(2, "0")}:00`, low: 5, mid: 40, high: 55,
    })));
    const result = scoreFireGlowSite({ id: "finder-021-location", latitude: 44.603, longitude: 81.146 }, record, date);
    expect(result.evening.score).not.toBeNull();
    expect(["22:00", "23:00"]).toContain(result.evening.peakTime);
    expect(result.evening.sunAltitude).toBeGreaterThanOrEqual(-6);
    expect(result.evening.sunAltitude).toBeLessThanOrEqual(4);
  });

  it("scores an eastern dawn before 04:00 without mixing it with sunset", () => {
    const date = "2026-06-21";
    const record = recordWithHours([{ time: `${date}T03:00`, low: 5, mid: 40, high: 55 }] );
    const result = scoreFireGlowSite({ id: "east", latitude: 48.36, longitude: 134.3 }, record, date);
    expect(result.morning.score).not.toBeNull();
    expect(result.morning.peakTime).toBe("03:00");
    expect(result.evening.score).toBeNull();
  });

  it("accepts provider times with seconds and skips malformed instants", () => {
    const record = recordWithHours([
      { time: "2026-08-22T19:00:00", low: 5, mid: 40, high: 55 },
      { time: "2026-08-22T99:00", low: 5, mid: 40, high: 55 },
    ]);
    const result = scoreFireGlowSite(SITE, record, "2026-08-22");
    expect(result.evening.score).not.toBeNull();
    expect(result.evening.peakTime).toBe("19:00");
  });

  it("withholds a score for impossible normalized cloud or precipitation inputs", () => {
    for (const bad of [{ low: -50 }, { high: 101 }, { precip: -1 }, { gust: -1 }, { visibility: -1 }]) {
      const record = recordWithHours([{ time: "2026-08-22T19:00", low: 5, mid: 40, high: 55, ...bad }]);
      expect(scoreFireGlowSite(SITE, record, "2026-08-22").evening.score).toBeNull();
    }
  });
  it("keeps a morning score on the requested dawn date instead of mixing in the next day", () => {
    const score = scoreFireGlowSite(
      SITE,
      recordWithHours([
        ...[4, 5, 6, 7, 8, 9].map((hour) => ({
          time: `2026-08-22T${String(hour).padStart(2, "0")}:00`,
          low: 5,
          mid: 40,
          high: 20,
        })),
        ...[4, 5, 6, 7, 8, 9].map((hour) => ({
          time: `2026-08-23T${String(hour).padStart(2, "0")}:00`,
          low: 0,
          mid: 0,
          high: 73,
        })),
      ]),
      "2026-08-22",
    );

    expect(score.morning.score).not.toBeNull();
    expect(score.morning.midCloud).toBe(40);
    expect(score.morning.highCloud).toBe(20);
  });

  it("rewards a broad mid/high deck with thin low cloud at twilight", () => {
    const score = scoreFireGlowSite(
      SITE,
      recordWithHours([
        { time: "2026-08-22T16:00", mid: 45, high: 30, low: 10 },
        { time: "2026-08-22T17:00", mid: 45, high: 30, low: 10 },
        { time: "2026-08-22T18:00", mid: 40, high: 30, low: 8 },
        { time: "2026-08-22T19:00", mid: 40, high: 30, low: 8 },
      ]),
      "2026-08-22",
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
      "2026-08-22",
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
      "2026-08-22",
    );
    expect(score.evening.band).toBe("none");
  });

  it("penalises a thick low deck blocking the lit clouds", () => {
    const open = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", mid: 40, high: 30, low: 5 }]),
      "2026-08-22",
    );
    const blocked = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", mid: 40, high: 30, low: 90 }]),
      "2026-08-22",
    );
    expect(blocked.evening.score!).toBeLessThan(open.evening.score!);
  });

  it("returns unknown windows when the record is missing", () => {
    const score = scoreFireGlowSite(SITE, undefined);
    expect(score.evening.band).toBe("unknown");
    expect(score.evening.score).toBeNull();
  });

  it("does not coerce missing twilight cloud data into clear zeroes", () => {
    const record = recordWithHours([
      { time: "2026-08-22T19:00", mid: 40, high: 30, low: 5, precip: 0 },
    ]);
    record.hourly!.cloud_cover_high[0] = null;

    const score = scoreFireGlowSite(SITE, record, "2026-08-22");
    expect(score.evening.band).toBe("unknown");
    expect(score.evening.score).toBeNull();
    expect(score.evening.probabilityLabel).toBeNull();
    expect(score.evening.reason).toContain("数据不完整");
  });

  it("builds a snapshot keyed by curated site ids", () => {
    const snapshot = buildFireGlowSnapshot("2026-08-22", "icon", {
      "2026-08-22": {},
    });
    expect(snapshot.date).toBe("2026-08-22");
    expect(snapshot.model).toBe("icon");
    expect(Object.keys(snapshot.sites).length).toBeGreaterThan(100);
  });

  it("preserves 192 fresh and 90 stale site records through real snapshot scoring", () => {
    const date = "2026-10-27";
    const now = Date.now();
    const record = recordWithHours(Array.from({ length: 24 }, (_, hour) => ({
      time: `${date}T${String(hour).padStart(2, "0")}:00`, low: 5, mid: 40, high: 55,
    })));
    record.model = "icon";
    record.fetchedAt = new Date(now).toISOString();
    expect(OBSERVING_SITES).toHaveLength(282);
    const records = Object.fromEntries(OBSERVING_SITES.map((site, index) => [site.id, {
      ...record, status: index < 192 ? "available" as const : "stale" as const,
    }]));
    const snapshot = buildFireGlowSnapshot(date, "icon", { [date]: records });
    expect(snapshot.stale).toBe(true);
    expect(Object.values(snapshot.sourceQuality!.bySite).filter((site) => site.status === "available")).toHaveLength(192);
    expect(Object.values(snapshot.sourceQuality!.bySite).filter((site) => site.status === "stale")).toHaveLength(90);
    for (const [start, end, expected] of [[0, 192, "fresh"], [192, 282, "stale"]] as const) {
      const site = OBSERVING_SITES.slice(start, end).find((item) => snapshot.sites[item.id].evening.score !== null);
      expect(site).toBeDefined();
      expect(fireGlowSiteQuality(snapshot, date, site!.id, "evening", "icon", undefined, now).state).toBe(expected);
    }
  });

  it("prefers high cloud over the same low-cloud coverage (weighted canvas)", () => {
    const highDeck = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", high: 60, mid: 0, low: 0 }]),
      "2026-08-22",
    );
    const lowDeck = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", high: 0, mid: 0, low: 60 }]),
      "2026-08-22",
    );
    expect(highDeck.evening.score!).toBeGreaterThan(lowDeck.evening.score!);
  });

  it("exposes condition-index bands, vividness, moments and twilight times", () => {
    const score = scoreFireGlowSite(
      SITE,
      recordWithHours([{ time: "2026-08-22T19:00", mid: 40, high: 35, low: 5 }]),
      "2026-08-22",
    );
    expect(score.evening.probabilityLabel).toMatch(/^\d+–\d+$/);
    expect(score.evening.probabilityLevel).toMatch(/^p(20|40|60|80|88|95|100)$/);
    expect(score.evening.vividness).not.toBeNull();
    expect(score.evening.vividness!).toBeLessThan(1);
    expect(score.evening.momentLabel).toBeTruthy();
    for (const field of ["goldenTime", "blueTime", "astroTime"] as const) {
      const value = score.evening[field];
      expect(value === null || /^\d{2}:\d{2}$/.test(value)).toBe(true);
    }
  });
});

describe("condition index presentation bands", () => {
  it("shows an index range containing the computed score, without inflating it", () => {
    for (let score = 0; score <= 100; score += 1) {
      const [low, high] = probabilityRangeFor(score)!.label.split("–").map(Number);
      expect(score, `index ${score} below display range`).toBeGreaterThanOrEqual(low!);
      expect(score, `index ${score} above display range`).toBeLessThanOrEqual(high!);
    }
  });

  it("does not give invalid scores a display range", () => {
    for (const score of [NaN, Infinity, -1, 101]) {
      expect(probabilityRangeFor(score)).toBeNull();
    }
  });
  it("maps scores to condition-index ranges while retaining legacy level ids", () => {
    expect(probabilityRangeFor(95)?.label).toBe("95–100");
    expect(probabilityRangeFor(88)?.level).toBe("p95");
    expect(probabilityRangeFor(84)?.label).toBe("80–88");
    expect(probabilityRangeFor(80)?.level).toBe("p88");
    expect(probabilityRangeFor(74)?.label).toBe("60–80");
    expect(probabilityRangeFor(72)?.level).toBe("p80");
    expect(probabilityRangeFor(60)?.label).toBe("60–80");
    expect(probabilityRangeFor(40)?.level).toBe("p60");
    expect(probabilityRangeFor(20)?.label).toBe("20–40");
    expect(probabilityRangeFor(5)?.level).toBe("p20");
    expect(probabilityRangeFor(null)).toBeNull();
  });
});

describe("isHighFireGlowLevel", () => {
  it("counts every high presentation tier including subdivided top tiers", () => {
    expect(isHighFireGlowLevel("p80")).toBe(true);
    expect(isHighFireGlowLevel("p88")).toBe(true);
    expect(isHighFireGlowLevel("p95")).toBe(true);
    expect(isHighFireGlowLevel("p100")).toBe(true);
    expect(isHighFireGlowLevel("p60")).toBe(false);
    expect(isHighFireGlowLevel(null)).toBe(false);
  });
});
