// Structure, night boundary and original-freshness tests for the astronomy scorer.
import { describe, it, expect } from "vitest";
import { evaluateNight, SCORE_MODEL_VERSION } from "@/lib/scoring";
import { isInNight } from "@/lib/nighttime";
import type { Location, LocationForecast, HourWeather } from "@/lib/types";

const NIGHT = "2026-08-12";
const NIGHT_TIMES = [
  "2026-08-12T20:00", "2026-08-12T21:00", "2026-08-12T22:00", "2026-08-12T23:00",
  "2026-08-13T00:00", "2026-08-13T01:00", "2026-08-13T02:00", "2026-08-13T03:00",
  "2026-08-13T04:00", "2026-08-13T05:00",
];
const OUT_TIMES = ["2026-08-12T19:00", "2026-08-13T06:00"];
function makeHour(time: string): HourWeather {
  return { time, temperature: 15, humidity: 60, dewPoint: 8, precipitationProbability: 0,
    precipitation: 0, weatherCode: 0, cloudCover: 10, cloudLow: 5, cloudMid: 5, cloudHigh: 5,
    visibility: 20000, windSpeed: 2, windGust: 4 };
}
const location: Location = { id: "test-site", name: "测试机位", latitude: 40, longitude: 116, elevation: 1000, source: "自定义" };
function forecast(): LocationForecast {
  // This is a synthetic fixture received now, not an assertion about the age of a historical provider run.
  const fetchedAt = new Date().toISOString();
  return { locationId: "test-site", modelLatitude: 40, modelLongitude: 116, modelElevation: 1000,
    timezone: "Asia/Shanghai", utcOffsetSeconds: 28800, fetchedAt,
    metadata: { source: "Open-Meteo", model: "icon", fetchedAt, stale: false, units: {} },
    hourly: [...NIGHT_TIMES, ...OUT_TIMES].map(makeHour) };
}
describe("evaluateNight — 结构与窗口", () => {
  it("返回非 null 的 NightEvaluation", () => {
    expect(evaluateNight(forecast(), location, NIGHT)).not.toBeNull();
  });
  it("夜间窗严格过滤为 20:00–次日 05:00（10 小时）", () => {
    const result = evaluateNight(forecast(), location, NIGHT)!;
    expect(result.hours).toHaveLength(10);
    for (const hour of result.hours) expect(isInNight(hour.time, NIGHT)).toBe(true);
    expect(result.hours.map((hour) => hour.time).sort()).toEqual([...NIGHT_TIMES].sort());
  });
  it("窗口外的 19:00 与 06:00 未被纳入", () => {
    const times = evaluateNight(forecast(), location, NIGHT)!.hours.map((hour) => hour.time);
    expect(times).not.toContain(OUT_TIMES[0]);
    expect(times).not.toContain(OUT_TIMES[1]);
  });
  it("identifies the integrity-reviewed scoring revision", () => {
    expect(evaluateNight(forecast(), location, NIGHT)!.scoreModelVersion).toBe("star-v1.2-integrity");
    expect(SCORE_MODEL_VERSION).toBe("star-v1.2-integrity");
  });
  it("决策字段存在且类型正确，单模型不宣称高置信度", () => {
    const result = evaluateNight(forecast(), location, NIGHT)!;
    expect(["go", "watch", "no", "trend"]).toContain(result.status);
    expect(typeof result.score).toBe("number");
    expect(result.confidence).toBeTypeOf("object");
    expect(typeof result.confidence.level).toBe("string");
    expect(result.confidence.kind).not.toBe("high");
    expect(typeof result.moonPhase).toBe("string");
    expect(Array.isArray(result.window)).toBe(true);
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(typeof result.windowLabel).toBe("string");
    expect(typeof result.reason).toBe("string");
  });
  it("窗口内各小时评分结构完整（含天文分量）", () => {
    for (const hour of evaluateNight(forecast(), location, NIGHT)!.hours) {
      expect(typeof hour.score).toBe("number");
      expect(typeof hour.sunAltitude).toBe("number");
      expect(typeof hour.moonIllumination).toBe("number");
      expect(typeof hour.galacticAltitude).toBe("number");
      expect(Array.isArray(hour.blockers)).toBe(true);
    }
  });
});
describe("evaluateNight — 空窗口与未知海拔", () => {
  it("无夜间小时时返回 null", () => {
    expect(evaluateNight({ ...forecast(), hourly: [{ time: "2026-08-12T12:00" }] }, location, NIGHT)).toBeNull();
  });
  it("地图取点没有海拔时仍可完成天文评测", () => {
    const unknownElevation = { ...location, elevation: null };
    expect(() => evaluateNight(forecast(), unknownElevation, NIGHT)).not.toThrow();
    expect(evaluateNight(forecast(), unknownElevation, NIGHT)).not.toBeNull();
  });
});
