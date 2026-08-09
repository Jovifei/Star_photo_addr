// Unit tests for cloudLayers.deriveCloudLayers.
// Focus: pressure-level profile → cloud decks, with partial missing heightMsl
// (must not crash), correct ascending sort, and relation/confidence fields.
import { describe, it, expect } from "vitest";
import { deriveCloudLayers, PRESSURE_LEVELS } from "@/lib/cloudLayers";
import type { PressureLevel } from "@/lib/types";

describe("deriveCloudLayers — 基本推导", () => {
  it("部分 heightMsl 缺失时不崩，并按高度升序分组", () => {
    const profile: PressureLevel[] = [
      { pressure: 1000, cloudCover: 60, humidity: 95, heightMsl: 100 }, // 云
      { pressure: 975, cloudCover: 50, humidity: 80, heightMsl: 300 }, // 晴
      { pressure: 950, cloudCover: 80, humidity: 50, heightMsl: 500 }, // 云
      { pressure: 925, cloudCover: 70, humidity: 50, heightMsl: 700 }, // 云
      { pressure: 900, cloudCover: 10, humidity: 50, heightMsl: undefined }, // 缺失高度→过滤
      { pressure: 850, cloudCover: 20, humidity: 50, heightMsl: 1500 }, // 晴
    ];
    const layers = deriveCloudLayers(profile, 0, 0);
    expect(Array.isArray(layers)).toBe(true);
    expect(layers).toHaveLength(2);
    // 高度升序
    expect(layers[0].baseMsl).toBeLessThan(layers[1].baseMsl);
    // 第一组 [100]，第二组 [500,700]
    expect(layers[0].baseMsl).toBe(100);
    expect(layers[0].topMsl).toBe(100);
    expect(layers[1].baseMsl).toBe(500);
    expect(layers[1].topMsl).toBe(700);
    // 关系与置信度字段存在
    expect(["云上", "云中", "云下"]).toContain(layers[0].relation);
    expect(["高", "中", "低"]).toContain(layers[0].confidence);
    expect(layers[1].confidence).toBe("中"); // 2 层 → 中
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
