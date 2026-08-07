// Unit tests for the night-window helper `isInNight`.
// Rule under test (see docs/design + constants): the observation window is
// 20:00 (local, evening date) → 05:00 (local, next morning). The canonical
// rule is "当日 ≥20:00 或 次日 ≤05:00 为夜间", i.e. the 05:00 hour is INCLUDED.
import { describe, it, expect } from "vitest";
import { isInNight } from "@/lib/nighttime";

const NIGHT = "2026-08-12"; // evening date; window spans → 2026-08-13 05:00

describe("isInNight — 当日夜间 (≥20:00)", () => {
  it("20:00 是夜间起点", () => {
    expect(isInNight("2026-08-12T20:00", NIGHT)).toBe(true);
  });
  it("23:59 属于夜间", () => {
    expect(isInNight("2026-08-12T23:59", NIGHT)).toBe(true);
  });
});

describe("isInNight — 次日跨日回绕 (≤05:00)", () => {
  it("00:00 属于次日夜间", () => {
    expect(isInNight("2026-08-13T00:00", NIGHT)).toBe(true);
  });
  it("04:59 属于次日夜间", () => {
    expect(isInNight("2026-08-13T04:59", NIGHT)).toBe(true);
  });
  it("05:00 按 ≤05:00 规则计入夜间（边界含入）", () => {
    // 规则明确为「次日 ≤05:00 为夜间」，实现用 hour <= NIGHT_END(5)。
    expect(isInNight("2026-08-13T05:00", NIGHT)).toBe(true);
  });
});

describe("isInNight — 非夜间窗口", () => {
  it("12:00 非夜间", () => {
    expect(isInNight("2026-08-12T12:00", NIGHT)).toBe(false);
  });
  it("19:59 未到 20:00，非夜间", () => {
    expect(isInNight("2026-08-12T19:59", NIGHT)).toBe(false);
  });
  it("06:00 越过 05:00，非夜间", () => {
    expect(isInNight("2026-08-13T06:00", NIGHT)).toBe(false);
  });
});
