import { describe, it, expect } from "vitest";
import { resolveElevation } from "../../src/lib/elevationLookup";

describe("resolveElevation", () => {
  it("resolves curated elevation for famous peaks", () => {
    expect(resolveElevation(30.4012, 119.2554, "浙江 · 太子尖 驿站附近取样点")).toBe(1557);
    expect(resolveElevation(30.25, 119.05, "牵牛岗")).toBe(1490);
    expect(resolveElevation(30.41, 119.58, "天荒坪江南天池")).toBe(980);
    expect(resolveElevation(29.77, 102.82, "牛背山顶")).toBe(3660);
  });

  it("preserves positive raw elevation", () => {
    expect(resolveElevation(31.0, 120.0, "任意地点", 234)).toBe(234);
  });

  it("handles unknown locations gracefully", () => {
    expect(resolveElevation(0, 0, "未知小点", 0)).toBe(0);
  });
});
