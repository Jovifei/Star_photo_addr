import { describe, expect, it } from "vitest";
import {
  nearestAirQualityValue,
  nearestKpValue,
  parseAirQualityPoints,
  parseKpPoints,
} from "@/lib/auxiliaryConditions";

describe("auxiliary condition selection", () => {
  it("parses only finite, in-range AQI and Kp records", () => {
    expect(
      parseAirQualityPoints({
        hourly: [
          { time: "2026-08-20T20:00", usAqi: 42 },
          { time: "2026-08-20T21:00", usAqi: null },
          { time: "2026-08-20T22:00", usAqi: 900 },
          { time: 123, usAqi: 50 },
        ],
      }),
    ).toEqual([{ time: "2026-08-20T20:00", usAqi: 42 }]);
    expect(
      parseKpPoints({
        frames: [
          { time: "2026-08-20 12:00:00.000", kp: 3.3 },
          { time: "2026-08-20 15:00:00.000", kp: 12 },
          { time: "", kp: 2 },
        ],
      }),
    ).toEqual([{ time: "2026-08-20 12:00:00.000", kp: 3.3 }]);
  });

  it("selects AQI for the active local forecast hour", () => {
    const points = [
      { time: "2026-08-20T20:00", usAqi: 30 },
      { time: "2026-08-20T22:00", usAqi: 70 },
    ];
    expect(nearestAirQualityValue(points, "2026-08-20T22:00")).toBe(70);
    expect(nearestAirQualityValue(points, "2026-08-20T21:40")).toBe(70);
    expect(nearestAirQualityValue(points, "2026-08-21T06:00")).toBeNull();
  });

  it("selects Kp nearest to the selected UTC instant without mutating input", () => {
    const points = [
      { time: "2026-08-20 12:00:00.000", kp: 2 },
      { time: "2026-08-20 15:00:00.000", kp: 5 },
    ];
    const original = [...points];
    expect(nearestKpValue(points, Date.parse("2026-08-20T14:30:00Z"))).toBe(5);
    expect(nearestKpValue(points, Date.parse("2026-08-21T12:00:00Z"))).toBeNull();
    expect(points).toEqual(original);
  });
});
