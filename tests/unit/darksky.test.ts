// Unit tests for the dark-sky (Bortle) pure helpers.
// Encoding: value 0 => nodata (null); 1..255 => 14 + (v-1)/254*8 mpsas.
// Classification uses the 8 descending thresholds in @/data/viirsMeta.
import { describe, it, expect } from "vitest";
import {
  mpsasFromValue,
  classifyBortle,
} from "@/lib/darksky";
import {
  BORTLE_CLASSES,
  BORTLE_LOWER_BOUNDS_MPSAS,
} from "@/data/viirsMeta";

describe("mpsasFromValue — VIIRS 编码", () => {
  it("value=0 → nodata (null)", () => {
    expect(mpsasFromValue(0)).toBeNull();
  });
  it("value=1 → 14 (下限)", () => {
    expect(mpsasFromValue(1)).toBe(14);
  });
  it("value=255 → 22 (上限)", () => {
    expect(mpsasFromValue(255)).toBe(22);
  });
  it("中间值单调递增（编码线性）", () => {
    expect(mpsasFromValue(2)!).toBeGreaterThan(mpsasFromValue(1)!);
    expect(mpsasFromValue(128)!).toBeGreaterThan(mpsasFromValue(64)!);
    expect(mpsasFromValue(255)!).toBeGreaterThan(mpsasFromValue(254)!);
  });
});

describe("classifyBortle — 等级阈值", () => {
  it("阈值数组降序且共 8 个边界 + 9 个等级", () => {
    expect(BORTLE_CLASSES.length).toBe(9);
    for (let i = 0; i < BORTLE_LOWER_BOUNDS_MPSAS.length - 1; i += 1) {
      expect(BORTLE_LOWER_BOUNDS_MPSAS[i]).toBeGreaterThan(
        BORTLE_LOWER_BOUNDS_MPSAS[i + 1],
      );
    }
  });

  it("每个边界值命中对应等级（≥阈值）", () => {
    for (let i = 0; i < BORTLE_LOWER_BOUNDS_MPSAS.length; i += 1) {
      expect(classifyBortle(BORTLE_LOWER_BOUNDS_MPSAS[i]).level).toBe(
        BORTLE_CLASSES[i].level,
      );
    }
  });

  it("边界值略低于阈值不串级（落在下一档）", () => {
    for (let i = 0; i < BORTLE_LOWER_BOUNDS_MPSAS.length - 1; i += 1) {
      const justBelow = BORTLE_LOWER_BOUNDS_MPSAS[i] - 0.01;
      expect(classifyBortle(justBelow).level).toBe(
        BORTLE_CLASSES[i + 1].level,
      );
    }
    // 低于最低阈值 → B9 兜底
    const belowLast = BORTLE_LOWER_BOUNDS_MPSAS.at(-1)! - 0.01;
    expect(classifyBortle(belowLast).level).toBe(9);
  });

  it("清晰落在各档中间的典型值", () => {
    expect(classifyBortle(22.0).level).toBe(1); // ≥21.99
    expect(classifyBortle(21.95).level).toBe(2); // 21.89..21.99
    expect(classifyBortle(21.78).level).toBe(3); // 21.69..21.89
    expect(classifyBortle(20.8).level).toBe(4); // 20.49..21.69
    expect(classifyBortle(19.8).level).toBe(5); // 19.5..20.49
    expect(classifyBortle(19.0).level).toBe(6); // 18.94..19.5
    expect(classifyBortle(18.5).level).toBe(7); // 18.38..18.94
    expect(classifyBortle(17.9).level).toBe(8); // 17.80..18.38
  });

  it("mpsas < 17.80（如 17.0）→ B9", () => {
    expect(classifyBortle(17.0).level).toBe(9);
  });

  it("null（nodata）→ B9 兜底", () => {
    expect(classifyBortle(null).level).toBe(9);
  });
});
