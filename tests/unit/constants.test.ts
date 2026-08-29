// Unit tests for the hardcoded Perseids 2026 constants.
import { describe, it, expect } from "vitest";
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_SUBDOMAINS,
  BASEMAP_TILE_URL,
  METEOR_SHOWER_NIGHTS,
  METEOR_PEAK_ISO,
  NIGHT_START,
  NIGHT_END,
} from "@/lib/constants";

describe("constants — 英仙座 2026 硬编码", () => {
  it("观测夜共 11 晚", () => {
    expect(METEOR_SHOWER_NIGHTS.length).toBe(11);
  });
  it("首晚 2026-08-07、末晚 2026-08-17", () => {
    expect(METEOR_SHOWER_NIGHTS[0]).toBe("2026-08-07");
    expect(METEOR_SHOWER_NIGHTS.at(-1)).toBe("2026-08-17");
  });
  it("峰值 ISO = 2026-08-13T12:00:00Z", () => {
    expect(METEOR_PEAK_ISO).toBe("2026-08-13T12:00:00Z");
  });
  it("夜间窗 NIGHT_START=20 / NIGHT_END=5", () => {
    expect(NIGHT_START).toBe(20);
    expect(NIGHT_END).toBe(5);
  });
});

describe("constants — 地图底图契约", () => {
  it("默认底图不再使用匿名 CARTO 水印端点，并保留 OSM 署名", () => {
    expect(BASEMAP_TILE_URL).not.toContain("cartocdn.com");
    expect(BASEMAP_TILE_URL).toContain("openstreetmap.org");
    expect(BASEMAP_ATTRIBUTION).toContain("OpenStreetMap");
  });

  it("始终向 Leaflet 提供非空 subdomains，避免 Firefox/WebKit 崩溃", () => {
    expect(typeof BASEMAP_SUBDOMAINS).toBe("string");
    expect(BASEMAP_SUBDOMAINS.length).toBeGreaterThan(0);
  });
});
