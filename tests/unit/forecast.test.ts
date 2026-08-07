// Unit tests for forecast.ts pure helpers (time normalization / UTC recovery).
// Open-Meteo returns local wall-clock "YYYY-MM-DDTHH:mm" (timezone=auto).
// `utc_offset_seconds` is in SECONDS per Open-Meteo's schema, so China +8h = 28800.
import { describe, it, expect } from "vitest";
import { parseProviderTime } from "@/lib/forecast";

describe("parseProviderTime — 本地墙钟还原真 UTC", () => {
  it("16 位输入无秒也正确补零", () => {
    // 无 offset：本地即 UTC
    expect(parseProviderTime("2026-08-13T04:00", 0).toISOString()).toBe(
      "2026-08-13T04:00:00.000Z",
    );
  });

  it("China +8 (utc_offset_seconds=28800)：本地 04:00 → UTC 前日 20:00", () => {
    // local 04:00 在 +8 时区 => 减去 8h => 2026-08-12 20:00 UTC
    expect(parseProviderTime("2026-08-13T04:00", 28800).toISOString()).toBe(
      "2026-08-12T20:00:00.000Z",
    );
  });

  it("China +8：本地 20:00 → UTC 同日 12:00", () => {
    expect(parseProviderTime("2026-08-12T20:00", 28800).toISOString()).toBe(
      "2026-08-12T12:00:00.000Z",
    );
  });

  it("负偏移（西时区）方向正确", () => {
    // 本地 04:00 在 UTC-5 => 加上 5h => 2026-08-13 09:00 UTC
    expect(parseProviderTime("2026-08-13T04:00", -18000).toISOString()).toBe(
      "2026-08-13T09:00:00.000Z",
    );
  });

  it("19 位（含秒）输入原样处理", () => {
    expect(parseProviderTime("2026-08-13T04:00:00", 0).toISOString()).toBe(
      "2026-08-13T04:00:00.000Z",
    );
  });
});
