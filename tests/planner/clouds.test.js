import { describe, expect, it } from "vitest";
import { deriveCloudLayers } from "../../src/features/planner/lib/clouds.js";

describe("pressure-profile cloud layers", () => {
  it("groups adjacent cloudy levels and never emits negative AGL", () => {
    const layers = deriveCloudLayers(
      [
        { pressure: 1000, heightMsl: 850, cloudCover: 90, humidity: 95 },
        { pressure: 975, heightMsl: 1050, cloudCover: 82, humidity: 92 },
        { pressure: 950, heightMsl: 1300, cloudCover: 10, humidity: 60 },
        { pressure: 925, heightMsl: 1550, cloudCover: 70, humidity: 91 },
      ],
      900,
      1450,
    );
    expect(layers).toHaveLength(2);
    expect(layers[0].baseAgl).toBe(0);
    expect(layers.every((layer) => layer.baseAgl >= 0 && layer.topAgl >= 0)).toBe(true);
    expect(layers[1].relation).toBe("云中");
  });

  it("does not invent a cloud layer from clear levels", () => {
    expect(deriveCloudLayers([{ heightMsl: 1200, cloudCover: 15, humidity: 50 }], 900, 1400)).toEqual([]);
  });
});
