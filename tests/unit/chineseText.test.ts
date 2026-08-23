import { describe, expect, it } from "vitest";
import { normalizeLocationTexts, toSimplifiedChinese } from "@/lib/chineseText";

describe("toSimplifiedChinese", () => {
  it("converts traditional place names from GeoNames", () => {
    expect(toSimplifiedChinese("臨安區")).toBe("临安区");
    expect(toSimplifiedChinese("溪頭")).toBe("溪头");
    expect(toSimplifiedChinese("臺灣省")).toBe("台湾省");
  });

  it("leaves simplified and non-CJK text untouched", () => {
    expect(toSimplifiedChinese("太子街")).toBe("太子街");
    expect(toSimplifiedChinese("Hangzhou")).toBe("Hangzhou");
  });

  it("passes through null and undefined without throwing", () => {
    expect(toSimplifiedChinese(null)).toBeNull();
    expect(toSimplifiedChinese(undefined)).toBeUndefined();
    expect(toSimplifiedChinese("")).toBe("");
  });
});

describe("normalizeLocationTexts", () => {
  it("normalizes name, province and area together", () => {
    expect(
      normalizeLocationTexts({ id: "x", name: "霧峰區", province: "臺灣省", area: "溪頭" }),
    ).toEqual({ id: "x", name: "雾峰区", province: "台湾省", area: "溪头" });
  });

  it("returns the same object reference when nothing changes", () => {
    const location = { id: "x", name: "太子街" };
    expect(normalizeLocationTexts(location)).toBe(location);
  });
});
