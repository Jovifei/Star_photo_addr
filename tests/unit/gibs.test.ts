import { describe, expect, it } from "vitest";
import {
  buildSatelliteFrame,
  extractLayerBlock,
  latLngToTile,
  parseTileTemplate,
  parseTimeDimension,
  tileUrl,
} from "@/lib/gibs";

const XML = `<Capabilities><Contents><Layer><Identifier>Other</Identifier></Layer><Layer><Identifier>Himawari_AHI_Band13_Clean_Infrared</Identifier><Dimension name="Time">2026-08-08T00:00:00Z,2026-08-09T06:30:00Z</Dimension><ResourceURL format="image/png" resourceType="tile" template="https://example/{Time}/{TileMatrix}/{TileRow}/{TileCol}.png" /></Layer></Contents></Capabilities>`;

describe("GIBS satellite capability parsing", () => {
  it("parses a whitelisted layer, latest observation and WMTS template", () => {
    const block = extractLayerBlock(XML, "Himawari_AHI_Band13_Clean_Infrared");
    expect(block).toContain("Himawari_AHI_Band13_Clean_Infrared");
    expect(parseTimeDimension(XML, "Himawari_AHI_Band13_Clean_Infrared").latest).toBe("2026-08-09T06:30:00Z");
    expect(parseTileTemplate(block ?? "")).toContain("{Time}");
  });

  it("keeps satellite frames explicitly observational and substitutes tile coordinates", () => {
    const frame = buildSatelliteFrame("cloud", "2026-08-09T06:30:00Z", "https://example/{Time}/{TileMatrix}/{TileRow}/{TileCol}.png");
    expect(frame.observed).toBe(true);
    expect(frame.isForecast).toBe(false);
    expect(frame.layer).toBe("Himawari_AHI_Band13_Clean_Infrared");
    expect(frame.observedAt).toBe(frame.time);
    expect(frame.label).toContain("卫星云");
    expect(tileUrl(frame.tileTemplate, frame.time, 6, 12, 21)).toContain("2026-08-09T06:30:00Z/6/21/12");
  });

  it("uses the complete 2016 Black Marble baseline for night lights", () => {
    const frame = buildSatelliteFrame("night-lights", "2016-01-01", "https://example/{Time}/{TileMatrix}/{TileRow}/{TileCol}.png");
    expect(frame.layer).toBe("VIIRS_Black_Marble");
    expect(frame.reference).toBe(true);
    expect(frame.label).toContain("2016");
    expect(frame.isForecast).toBe(false);
  });

  it("clamps geographic tile lookup to the Web Mercator limits", () => {
    const tile = latLngToTile(90, 200, 8);
    expect(tile.x).toBeGreaterThanOrEqual(0);
    expect(tile.x).toBeLessThan(256);
    expect(tile.y).toBeGreaterThanOrEqual(0);
    expect(tile.y).toBeLessThan(256);
  });
});
