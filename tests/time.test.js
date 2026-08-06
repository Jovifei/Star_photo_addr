import { describe, expect, it } from "vitest";
import { addDays, isInNight, nextNightKeys, parseProviderTime } from "../src/lib/time";

describe("China-local night handling", () => {
  it("treats 18:00 through next-day 06:00 as one observing night", () => {
    expect(isInNight("2026-08-11T18:00", "2026-08-11")).toBe(true);
    expect(isInNight("2026-08-12T06:00", "2026-08-11")).toBe(true);
    expect(isInNight("2026-08-12T07:00", "2026-08-11")).toBe(false);
  });

  it("keeps provider timestamps in UTC+8", () => {
    expect(parseProviderTime("2026-08-11T20:00").toISOString()).toBe("2026-08-11T12:00:00.000Z");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("uses the previous calendar date before 07:00 China time", () => {
    const keys = nextNightKeys(2, new Date("2026-08-11T21:30:00.000Z"));
    expect(keys).toEqual(["2026-08-11", "2026-08-12"]);
  });
});
