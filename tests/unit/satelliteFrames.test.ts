import { describe, expect, it } from "vitest";
import {
  preserveLastValidSatelliteFrames,
  satelliteMaxNativeZoom,
  validSatelliteFrames,
} from "@/lib/satelliteFrames";

const cloudFrame = {
  time: "2026-08-19T12:00:00Z",
  observedAt: "2026-08-19T12:00:00Z",
  kind: "cloud",
  layer: "Himawari_AHI_Band13_Clean_Infrared",
  label: "卫星云观测",
  satellite: "Himawari AHI Band 13",
  source: "NASA GIBS",
  tileTemplate:
    "https://gibs.example/{Time}/{TileMatrix}/{TileRow}/{TileCol}.png",
  coverage: "东亚",
  observed: true,
  isForecast: false,
  reference: false,
} as const;

const nightLightFrame = {
  ...cloudFrame,
  time: "2016-01-01",
  observedAt: "2016-01-01",
  kind: "night-lights",
  layer: "VIIRS_Black_Marble",
  label: "卫星夜光",
  satellite: "VIIRS Black Marble",
  reference: true,
} as const;

describe("satellite frame catalogue", () => {
  it("does not allow cloud frames to leak into night-light mode", () => {
    expect(
      validSatelliteFrames("night-lights", [cloudFrame, nightLightFrame]),
    ).toEqual([nightLightFrame]);
    expect(validSatelliteFrames("cloud", [nightLightFrame])).toEqual([]);
  });

  it("rejects malformed or forecast frames", () => {
    expect(
      validSatelliteFrames("cloud", [
        { ...cloudFrame, tileTemplate: "https://example.com/tile.png" },
        { ...cloudFrame, isForecast: true },
        null,
      ]),
    ).toEqual([]);
  });

  it("matches the native zoom ceilings of the GIBS matrix sets", () => {
    expect(satelliteMaxNativeZoom("cloud")).toBe(6);
    expect(satelliteMaxNativeZoom("night-lights")).toBe(8);
  });

  it("keeps the last valid frame when a refresh returns no usable frame", () => {
    expect(
      preserveLastValidSatelliteFrames([cloudFrame], [], "卫星时次接口暂时不可达"),
    ).toEqual({
      frames: [cloudFrame],
      error: "卫星时次接口暂时不可达",
      stale: true,
    });
  });
});
