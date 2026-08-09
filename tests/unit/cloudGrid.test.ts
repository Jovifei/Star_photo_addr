import { describe, expect, it } from "vitest";
import {
  averageLayer,
  cloudLayerValueToColor,
  forecastDaysForNight,
  generateGridBounds,
  getValuesAtTime,
  idwInterpolate,
} from "@/lib/cloudGrid";
import type { CloudGridData } from "@/lib/types";

describe("云图网格与时间轴", () => {
  it("为高、中、低云使用可区分的颜色并限制比例范围", () => {
    expect(cloudLayerValueToColor("high", 50)).toContain("121, 207, 226");
    expect(cloudLayerValueToColor("mid", 50)).toContain("212, 178, 115");
    expect(cloudLayerValueToColor("low", 50)).toContain("169, 155, 247");
    expect(cloudLayerValueToColor("high", -10)).toMatch(/, 0\.000\)$/);
    expect(cloudLayerValueToColor("high", 120)).toMatch(/, 0\.750\)$/);
  });

  it("IDW 在采样点返回原值，在中点平滑插值", () => {
    const points = [
      { x: 0, y: 0, value: 0 },
      { x: 10, y: 0, value: 100 },
    ];
    expect(idwInterpolate(0, 0, points)).toBe(0);
    expect(idwInterpolate(10, 0, points)).toBe(100);
    expect(idwInterpolate(5, 0, points)).toBeCloseTo(50);
  });

  it("支持 20:00 到次日 05:00 的第 10 档，并计算三层平均值", () => {
    const hourly = Array.from({ length: 10 }, (_, index) => ({
      time: index < 4
        ? `2026-08-12T${20 + index}:00`
        : `2026-08-13T0${index - 4}:00`,
      cloudHigh: index * 10,
      cloudMid: index * 5,
      cloudLow: 100 - index * 10,
    }));
    const grid = {
      samples: [{ latitude: 30, longitude: 120 }],
      bounds: { north: 30, south: 30, east: 120, west: 120 },
      nightKeys: ["2026-08-12"],
      forecasts: [{
        locationId: "test",
        modelLatitude: 30,
        modelLongitude: 120,
        modelElevation: 0,
        timezone: "Asia/Shanghai",
        utcOffsetSeconds: 28800,
        fetchedAt: "2026-08-07T00:00:00Z",
        hourly,
      }],
      fetchedAt: "2026-08-07T00:00:00Z",
    } satisfies CloudGridData;

    const finalTick = getValuesAtTime(grid, 9);
    expect(finalTick).toEqual({ high: [90], mid: [45], low: [10] });
    expect(averageLayer([10, 20, 30])).toBe(20);
  });

  it("远期夜晚会自动请求足够天数且不超过预报上限", () => {
    const now = new Date("2026-08-07T04:00:00Z");
    expect(forecastDaysForNight("2026-08-07", now)).toBe(2);
    expect(forecastDaysForNight("2026-08-12", now)).toBe(7);
    expect(forecastDaysForNight("2026-09-30", now)).toBe(16);
  });

  it("地图被拖到日期变更线外时，采样经度仍归一化到 [-180,180]", () => {
    // Simulate a Leaflet bounds whose east exceeds 180 (worldCopyJump disabled).
    const bounds = {
      getNorth: () => 60,
      getSouth: () => 20,
      getEast: () => 233,
      getWest: () => 80,
    };
    const { samples } = generateGridBounds(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      bounds as any,
      3,
      4,
    );
    for (const sample of samples) {
      expect(sample.longitude).toBeGreaterThanOrEqual(-180);
      expect(sample.longitude).toBeLessThanOrEqual(180);
      expect(sample.latitude).toBeGreaterThanOrEqual(-90);
      expect(sample.latitude).toBeLessThanOrEqual(90);
    }
    // The easternmost column should wrap, not be 233 which Open-Meteo rejects.
    const lons = samples.map((s) => s.longitude);
    expect(Math.max(...lons)).toBeLessThanOrEqual(180);
  });
});
