// Unit tests for the hardcoded Perseids 2026 constants.
import { describe, it, expect } from "vitest";
import {
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
