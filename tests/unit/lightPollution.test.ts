import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_POLLUTION_TILE_URL,
  materializeLightPollutionTile,
} from "@/lib/lightPollution";

describe("light pollution tile configuration", () => {
  it("materializes a concrete WMTS tile URL without placeholders", () => {
    const url = materializeLightPollutionTile(
      DEFAULT_LIGHT_POLLUTION_TILE_URL,
      4,
      12,
      6,
    );
    expect(url).toContain("VIIR_2023");
    expect(
      url.includes("TileMatrix=EPSG%3A900913%3A4") ||
        url.includes("TileMatrix=EPSG:900913:4"),
    ).toBe(true);
    expect(url).toContain("TileCol=12");
    expect(url).toContain("TileRow=6");
    expect(url).not.toMatch(/\{[zxy]\}/);
  });
});
