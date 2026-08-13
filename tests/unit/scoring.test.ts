// Unit tests for the scoring engine `evaluateNight`.
// We feed a fixed LocationForecast (11 night-side hours for 2026-08-12, plus
// 2 out-of-window hours) and assert the OUTPUT STRUCTURE is complete, the
// night window is filtered EXACTLY to 20:00–05:00, and the decision fields are
// present with correct types. Numeric scores are not asserted (astronomy-
// derived); structure + window boundary are the focus.
import { describe, it, expect } from "vitest";
import { evaluateNight, SCORE_MODEL_VERSION } from "@/lib/scoring";
import { isInNight } from "@/lib/nighttime";
import type { Location, LocationForecast, HourWeather } from "@/lib/types";

const NIGHT = "2026-08-12";

// 10 hours inside the window (20:00..05:00) + 2 outside (19:00, 06:00).
const NIGHT_TIMES = [
  "2026-08-12T20:00",
  "2026-08-12T21:00",
  "2026-08-12T22:00",
  "2026-08-12T23:00",
  "2026-08-13T00:00",
  "2026-08-13T01:00",
  "2026-08-13T02:00",
  "2026-08-13T03:00",
  "2026-08-13T04:00",
  "2026-08-13T05:00",
];
const OUT_TIMES = ["2026-08-12T19:00", "2026-08-13T06:00"];

function makeHour(time: string): HourWeather {
  return {
    time,
    temperature: 15,
    humidity: 60,
    dewPoint: 8,
    precipitationProbability: 0,
    precipitation: 0,
    weatherCode: 0,
    cloudCover: 10,
    cloudLow: 5,
    cloudMid: 5,
    cloudHigh: 5,
    visibility: 20000,
    windSpeed: 2,
    windGust: 4,
  };
}

const location: Location = {
  id: "test-site",
  name: "测试机位",
  latitude: 40.0,
  longitude: 116.0,
  elevation: 1000,
  source: "自定义",
};

const forecast: LocationForecast = {
  locationId: "test-site",
  modelLatitude: 40.0,
  modelLongitude: 116.0,
  modelElevation: 1000,
  timezone: "Asia/Shanghai",
  utcOffsetSeconds: 28800, // China +8
  fetchedAt: "2026-08-01T00:00:00.000Z",
  hourly: [...NIGHT_TIMES, ...OUT_TIMES].map(makeHour),
};

describe("evaluateNight — 结构与窗口", () => {
  const result = evaluateNight(forecast, location, NIGHT);

  it("返回非 null 的 NightEvaluation", () => {
    expect(result).not.toBeNull();
  });

  it("夜间窗严格过滤为 20:00–次日 05:00（10 小时）", () => {
    expect(result!.hours).toHaveLength(10);
    for (const hour of result!.hours) {
      expect(isInNight(hour.time, NIGHT)).toBe(true);
    }
    const times = result!.hours.map((h) => h.time).sort();
    expect(times).toEqual([...NIGHT_TIMES].sort());
  });

  it("窗口外的 19:00 与 06:00 未被纳入", () => {
    const times = result!.hours.map((h) => h.time);
    expect(times).not.toContain("2026-08-12T19:00");
    expect(times).not.toContain("2026-08-13T06:00");
  });

  it("scoreModelVersion = star-v1.0", () => {
    expect(result!.scoreModelVersion).toBe("star-v1.0");
    expect(SCORE_MODEL_VERSION).toBe("star-v1.0");
  });

  it("决策字段存在且类型正确", () => {
    expect(["go", "watch", "no", "trend"]).toContain(result!.status);
    expect(typeof result!.score).toBe("number");
    expect(result!.confidence).toBeTypeOf("object");
    expect(typeof result!.confidence.level).toBe("string");
    expect(typeof result!.confidence.kind).toBe("string");
    expect(typeof result!.moonPhase).toBe("string");
    expect(Array.isArray(result!.window)).toBe(true);
    expect(Array.isArray(result!.blockers)).toBe(true);
    expect(typeof result!.windowLabel).toBe("string");
    expect(typeof result!.reason).toBe("string");
  });

  it("窗口内各小时评分结构完整（含天文分量）", () => {
    for (const hour of result!.hours) {
      expect(typeof hour.score).toBe("number");
      expect(typeof hour.sunAltitude).toBe("number");
      expect(typeof hour.moonIllumination).toBe("number");
      expect(typeof hour.galacticAltitude).toBe("number");
      expect(Array.isArray(hour.blockers)).toBe(true);
    }
  });
});

describe("evaluateNight — 空窗口兜底", () => {
  it("无夜间小时时返回 null", () => {
    const empty: LocationForecast = {
      ...forecast,
      hourly: [{ time: "2026-08-12T12:00" }],
    };
    expect(evaluateNight(empty, location, NIGHT)).toBeNull();
  });
});

describe("evaluateNight — 未知海拔", () => {
  it("地图取点没有海拔时仍可完成天文评测", () => {
    const locationWithoutElevation = {
      ...location,
      elevation: null,
    } as unknown as Location;

    expect(() => evaluateNight(forecast, locationWithoutElevation, NIGHT)).not.toThrow();
    expect(evaluateNight(forecast, locationWithoutElevation, NIGHT)).not.toBeNull();
  });
});
