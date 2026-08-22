import { describe, expect, it } from "vitest";
import { normalizeGeocodeResults } from "@/lib/geocode";

describe("normalizeGeocodeResults", () => {
  it("drops malformed results instead of manufacturing a 0,0 location", () => {
    const results = normalizeGeocodeResults([
      { id: 1, name: "杭州", latitude: 30.2741, longitude: 120.1551 },
      { id: 2, name: "缺纬度", longitude: 120 },
      { id: 3, name: "超界", latitude: 95, longitude: 120 },
      { id: 4, name: "", latitude: 0, longitude: 0 },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 1,
      name: "杭州",
      latitude: 30.2741,
      longitude: 120.1551,
    });
  });

  it("uses a deterministic negative fallback id while preserving legal 0,0", () => {
    const results = normalizeGeocodeResults([
      { name: "Null Island", latitude: 0, longitude: 0 },
    ]);
    expect(results).toEqual([
      expect.objectContaining({
        id: -1,
        name: "Null Island",
        latitude: 0,
        longitude: 0,
      }),
    ]);
  });

  it("normalizes traditional geonames to simplified Chinese", () => {
    const results = normalizeGeocodeResults([
      { id: 7, name: "臨安區", admin1: "浙江", latitude: 30, longitude: 119 },
      { id: 8, name: "太子街", latitude: 30, longitude: 119 },
    ]);
    expect(results[0]).toMatchObject({ name: "临安区", admin1: "浙江" });
    expect(results[1]).toMatchObject({ name: "太子街" });
  });
});
