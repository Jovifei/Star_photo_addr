import { describe, expect, it } from "vitest";
import {
  addDays,
  formatNightLabel,
  isInNight,
  nextNightKeys,
  parseProviderTime,
} from "../../src/features/planner/lib/time.js";

describe("China-local night handling", () => {
  it("treats 20:00 through next-day 05:00 as one observing night", () => {
    expect(isInNight("2026-08-11T19:00", "2026-08-11")).toBe(false);
    expect(isInNight("2026-08-11T20:00", "2026-08-11")).toBe(true);
    expect(isInNight("2026-08-12T05:00", "2026-08-11")).toBe(true);
    expect(isInNight("2026-08-12T06:00", "2026-08-11")).toBe(false);
  });

  it("keeps provider timestamps in UTC+8", () => {
    expect(parseProviderTime("2026-08-11T20:00").toISOString()).toBe("2026-08-11T12:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("uses the previous calendar date before 07:00 China time", () => {
    const keys = nextNightKeys(2, new Date("2026-08-11T21:30:00.000Z"));
    expect(keys).toEqual(["2026-08-11", "2026-08-12"]);
  });

  it("labels the evening date, weekday and cross-midnight window", () => {
    expect(formatNightLabel("2026-08-07")).toContain("周五");
    expect(formatNightLabel("2026-08-07")).toContain("20:00–次日05:00");
    expect(formatNightLabel("2026-08-07", true)).toBe("8/7 周五夜");
  });
});
