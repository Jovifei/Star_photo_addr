// Unit tests for pressure-level cloud-layer and inversion derivation.
import { describe, it, expect } from "vitest";
import {
  deriveCloudLayers,
  detectTemperatureInversion,
  PRESSURE_LEVELS,
} from "@/lib/cloudLayers";
import type { PressureLevel } from "@/lib/types";

describe("deriveCloudLayers — 基本推导", () => {
  it("部分 heightMsl 缺失时不崩，并按高度升序分组", () => {
    const profile: PressureLevel[] = [
      { pressure: 1000, cloudCover: 60, humidity: 95, heightMsl: 100 },
      { pressure: 975, cloudCover: 50, humidity: 80, heightMsl: 300 },
      { pressure: 950, cloudCover: 80, humidity: 50, heightMsl: 500 },
      { pressure: 925, cloudCover: 70, humidity: 50, heightMsl: 700 },
      { pressure: 900, cloudCover: 10, humidity: 50, heightMsl: undefined },
      { pressure: 850, cloudCover: 20, humidity: 50, heightMsl: 1500 },
    ];
    const layers = deriveCloudLayers(profile, 0, 0);
    expect(Array.isArray(layers)).toBe(true);
    expect(layers).toHaveLength(2);
    expect(layers[0].baseMsl).toBeLessThan(layers[1].baseMsl);
    expect(layers[0].baseMsl).toBe(100);
    expect(layers[0].topMsl).toBe(100);
    expect(layers[1].baseMsl).toBe(500);
    expect(layers[1].topMsl).toBe(700);
    expect(["云上", "云中", "云下"]).toContain(layers[0].relation);
    expect(["高", "中", "低"]).toContain(layers[0].confidence);
    expect(layers[1].confidence).toBe("中");
  });

  it("全晴 profile → 无云层", () => {
    const profile: PressureLevel[] = PRESSURE_LEVELS.map((pressure) => ({
      pressure,
      cloudCover: 5,
      humidity: 40,
      heightMsl: pressure * 10,
    }));
    expect(deriveCloudLayers(profile, 0, 0)).toHaveLength(0);
  });

  it("空 profile → 空数组", () => {
    expect(deriveCloudLayers([], 0, 0)).toHaveLength(0);
  });

  it("全部 heightMsl 缺失 → 不崩且返回空", () => {
    const profile: PressureLevel[] = [
      { pressure: 1000, cloudCover: 90, heightMsl: undefined },
      { pressure: 850, cloudCover: 90, heightMsl: undefined },
    ];
    expect(() => deriveCloudLayers(profile, 0, 0)).not.toThrow();
    expect(deriveCloudLayers(profile, 0, 0)).toHaveLength(0);
  });
});

describe("detectTemperatureInversion", () => {
  it("detects temperature increasing with height and reports strength", () => {
    const profile: PressureLevel[] = [
      { pressure: 950, temperature: 8, heightMsl: 500 },
      { pressure: 925, temperature: 10.2, heightMsl: 800 },
      { pressure: 900, temperature: 7, heightMsl: 1100 },
    ];
    expect(detectTemperatureInversion(profile, 300, 1500)).toEqual({
      status: "detected",
      lowerMsl: 500,
      upperMsl: 800,
      deltaTempC: 2.2,
      strength: "moderate",
    });
  });

  it("does not call a normal lapse-rate profile an inversion", () => {
    const profile: PressureLevel[] = [
      { pressure: 950, temperature: 12, heightMsl: 500 },
      { pressure: 925, temperature: 10, heightMsl: 800 },
      { pressure: 900, temperature: 8, heightMsl: 1100 },
    ];
    expect(detectTemperatureInversion(profile, 300, 1500).status).toBe(
      "not-detected",
    );
  });

  it("returns unavailable when fewer than two valid levels remain", () => {
    const profile: PressureLevel[] = [
      { pressure: 950, temperature: 12, heightMsl: 500 },
      { pressure: 925, temperature: undefined, heightMsl: 800 },
    ];
    expect(detectTemperatureInversion(profile, 300, 1500).status).toBe(
      "unavailable",
    );
  });

  it("ignores model levels below the model surface and above the requested cap", () => {
    const profile: PressureLevel[] = [
      { pressure: 1000, temperature: 6, heightMsl: 100 },
      { pressure: 950, temperature: 8, heightMsl: 500 },
      { pressure: 925, temperature: 9, heightMsl: 800 },
      { pressure: 850, temperature: 15, heightMsl: 1800 },
    ];
    const evidence = detectTemperatureInversion(profile, 450, 1200);
    expect(evidence.status).toBe("detected");
    expect(evidence.lowerMsl).toBe(500);
    expect(evidence.upperMsl).toBe(800);
  });
});
