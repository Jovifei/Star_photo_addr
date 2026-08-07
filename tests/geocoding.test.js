import { describe, expect, it } from "vitest";
import { normalizeGeocodingResult } from "../src/lib/geocoding";

describe("geocoding normalization", () => {
  it("keeps coordinates, elevation and readable administrative context", () => {
    expect(normalizeGeocodingResult({
      id: 1808926,
      name: "杭州市",
      latitude: 30.29365,
      longitude: 120.16142,
      elevation: 12,
      admin1: "浙江",
      admin2: "杭州",
      country: "中国",
      timezone: "Asia/Shanghai",
    })).toMatchObject({
      id: "search-1808926",
      name: "杭州市",
      context: "浙江 · 杭州 · 中国",
      latitude: 30.29365,
      longitude: 120.16142,
      elevation: 12,
      timezone: "Asia/Shanghai",
    });
  });

  it("rejects malformed results and preserves unknown elevation", () => {
    expect(normalizeGeocodingResult({ name: "坏数据", latitude: null, longitude: 120 })).toBeNull();
    expect(normalizeGeocodingResult({ name: "山峰", latitude: 30, longitude: 119 }).elevation).toBeNull();
  });
});
