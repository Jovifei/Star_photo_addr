import { describe, expect, it } from "vitest";
import {
  analyzeFinderNightWeather,
  evaluateFinderRating,
  evaluateFinderLocation,
  wmoToType,
} from "@/lib/stargazingFinder";
import { addFinderDays, FINDER_LOCATIONS, getShanghaiDate } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import type { FinderHourlyData } from "@/lib/stargazingFinderTypes";
import { buildObservationSnapshot, scoreObservingSite, OBSERVING_SITES } from "@/lib/observingSites";

function fixture(overrides: Partial<FinderHourlyData> = {}): FinderHourlyData {
  const time = Array.from({ length: 33 }, (_, index) => {
    const hour = 7 + index;
    const dayOffset = Math.floor(hour / 24);
    const hourOfDay = hour % 24;
    return `${addFinderDays("2026-08-09", dayOffset)}T${String(hourOfDay).padStart(2, "0")}:00`;
  });
  const values = (value: number | null) => Array.from({ length: time.length }, () => value);
  return {
    time,
    weather_code: values(0),
    cloud_cover: values(5),
    cloud_cover_low: values(0),
    cloud_cover_mid: values(0),
    cloud_cover_high: values(0),
    precipitation: values(0),
    visibility: values(20_000),
    wind_speed_10m: values(1),
    wind_gusts_10m: values(2),
    temperature_2m: values(22),
    ...overrides,
  };
}

describe("观星地点查询快照与评分", () => {
  it("包含目标站 242 个地点，Bortle 3 默认显示 222 个", () => {
    expect(FINDER_LOCATIONS).toHaveLength(242);
    expect(FINDER_LOCATIONS.filter((location) => location.bortle <= 3)).toHaveLength(222);
    expect(FINDER_LOCATIONS.filter((location) => location.bortle <= 4)).toHaveLength(242);
    expect(new Set(FINDER_LOCATIONS.map((location) => location.id)).size).toBe(242);
  });

  it("跨午夜分析包含 19:00 至次日 04:00，并保留空值语义", () => {
    const hourly = fixture({
      time: ["2026-08-09T19:00", "2026-08-10T00:00", "2026-08-10T04:00"],
      weather_code: [0, null, 3],
      cloud_cover: [0, null, null],
      cloud_cover_low: [0, null, null],
      cloud_cover_mid: [0, null, null],
      cloud_cover_high: [0, null, null],
      precipitation: [0, null, 1],
      visibility: [20_000, null, null],
      wind_speed_10m: [1, null, 9],
      wind_gusts_10m: [2, null, 12],
      temperature_2m: [22, null, 18],
    });
    const analysis = analyzeFinderNightWeather("2026-08-09", hourly, "photo");
    expect(analysis?.nightHours.map((hour) => hour.time)).toEqual([
      "2026-08-09T19:00",
      "2026-08-10T00:00",
      "2026-08-10T04:00",
    ]);
    expect(analysis?.nightHours[1]?.cloud).toBeNull();
    expect(analysis?.nightCloudyCount).toBeGreaterThan(0);
    expect(evaluateFinderRating(analysis, "photo")).toBe("poor");
  });

  it("完整晴空数据可评为完美，缺失数据不会被当成晴空", () => {
    const clear = analyzeFinderNightWeather("2026-08-09", fixture(), "photo");
    expect(evaluateFinderRating(clear, "photo")).toBe("perfect");

    const missing = fixture({
      cloud_cover: Array.from({ length: 33 }, () => null),
      cloud_cover_low: Array.from({ length: 33 }, () => null),
      cloud_cover_mid: Array.from({ length: 33 }, () => null),
      cloud_cover_high: Array.from({ length: 33 }, () => null),
      weather_code: Array.from({ length: 33 }, () => null),
    });
    const analysis = analyzeFinderNightWeather("2026-08-09", missing, "photo");
    expect(analysis?.nightCloudyCount).toBe(10);
    expect(wmoToType(null)).toBe("—");
  });

  it("地点详情评分与地点风险共用同一条数据链", () => {
    const location = FINDER_LOCATIONS.find((item) => item.name === "阿里暗夜公园");
    expect(location).toBeDefined();
    const evaluation = evaluateFinderLocation(location!, { hourly: fixture(), status: "available" }, "2026-08-09", "photo");
    expect(evaluation.analysis).not.toBeNull();
    expect(evaluation.score).toBeTypeOf("number");
    expect(evaluation.altitudeWarning).not.toBeNull();
  });

  it("上海日期函数使用运行时日期而不是旧的固定日期", () => {
    expect(getShanghaiDate(new Date("2026-08-08T16:30:00.000Z"))).toBe("2026-08-09");
    expect(addFinderDays("2026-08-09", 4)).toBe("2026-08-13");
  });

  it("共享观测评分保留空值、硬性天气门禁并生成多夜快照", () => {
    const site = OBSERVING_SITES[0]!;
    const rainy = fixture({
      precipitation: Array.from({ length: 33 }, () => 0.6),
      cloud_cover: Array.from({ length: 33 }, () => 15),
      wind_gusts_10m: Array.from({ length: 33 }, () => 4),
    });
    const score = scoreObservingSite(site, { hourly: rainy, status: "available" }, "2026-08-09");
    expect(score.score).toBeTypeOf("number");
    expect(score.band).toBe("not-recommended");
    expect(score.blockers).toContain("小时降水达到 0.5 mm");

    const snapshot = buildObservationSnapshot("2026-08-09", 3, "icon", {
      "2026-08-09": { [site.id]: { hourly: fixture(), status: "available" } },
      "2026-08-10": { [site.id]: { hourly: fixture(), status: "available" } },
      "2026-08-11": { [site.id]: { hourly: fixture(), status: "available" } },
    });
    expect(snapshot.days).toBe(3);
    expect(snapshot.sites[site.id]).toHaveLength(3);
    expect(snapshot.sites[site.id]?.[0]?.score).toBeTypeOf("number");
  });
  it("does not score a night when cloud coverage is mostly missing", () => {
    const site = OBSERVING_SITES[0]!;
    const missingCloud = fixture({
      cloud_cover: Array.from({ length: 33 }, () => null),
      precipitation: Array.from({ length: 33 }, () => 0),
      wind_speed_10m: Array.from({ length: 33 }, () => 1),
      wind_gusts_10m: Array.from({ length: 33 }, () => 2),
    });
    const score = scoreObservingSite(site, { hourly: missingCloud, status: "available" }, "2026-08-09");
    expect(score.score).toBeNull();
    expect(score.band).toBe("unknown");
    expect(score.cloud).toBeNull();
  });
});
