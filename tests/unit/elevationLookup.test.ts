import { describe, it, expect } from "vitest";
import { resolveElevation } from "../../src/lib/elevationLookup";

describe("resolveElevation", () => {
  it("resolves curated elevation for famous peaks", () => {
    expect(resolveElevation("太子尖")).toBe(1557);
    expect(resolveElevation("牵牛岗")).toBe(1490);
    expect(resolveElevation("天荒坪")).toBe(980);
    expect(resolveElevation("牛背山")).toBe(3660);
  });

  it("preserves positive raw elevation", () => {
    expect(resolveElevation("任意地点", 234)).toBe(234);
  });

  it("preserves an explicitly supplied sea-level elevation", () => {
    expect(resolveElevation("太子尖", 0)).toBe(0);
  });

  it("does not present missing elevation as sea level", () => {
    expect(resolveElevation("未知小点")).toBeNull();
  });

  it("does not borrow a nearby peak elevation for a sampled coordinate", () => {
    expect(resolveElevation("浙江 · 太子尖驿站附近取样点")).toBeNull();
  });

  it("only resolves curated names on an exact normalized name match", () => {
    expect(resolveElevation(" 太子尖 ")).toBe(1557);
  });
});
