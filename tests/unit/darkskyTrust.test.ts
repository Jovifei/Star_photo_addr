import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { OBSERVING_SITES, scoreObservingSite, scoreObservingSiteAtTime } from "@/lib/observingSites";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

describe("dark-sky trust boundary", () => {
  it("does not ship geographic/elevation Bortle heuristics", () => {
    const source = fs.readFileSync("src/lib/darksky.ts", "utf8");
    expect(source).not.toContain("estimateDarkSky");
    expect(source).not.toContain("mpsasForBortle");
    expect(source).not.toContain("卫星估算");
    expect(source).not.toContain("点位预估");
    expect(source).toContain("missing raster remains missing data");
  });
  it("keeps catalog Bortle out of candidate placeholder scores and metadata", () => {
    const source = fs.readFileSync("src/components/CandidateList.tsx", "utf8");
    expect(source).not.toContain("FINDER_LOCATIONS");
    expect(source).not.toContain("cand.bortle");
    expect(source).not.toContain("candidate.bortle");
    expect(source).not.toContain("Baseline estimation based on Bortle");
    expect(source).toContain("score: null");
    expect(source).toContain("数据不足");
  });
  it("labels B1-B4 site-library filters as catalog reference rather than measurement", () => {
    const source = fs.readFileSync("src/components/BortleFilterBar.tsx", "utf8");
    expect(source).toContain("目录参考暗空级别");
    expect(source).toContain("参考 B");
    expect(source).toContain("不是当前栅格或现场 SQM 实测");
  });
  it("gives identical non-null live scores regardless of catalog Bortle", () => {
    const base = OBSERVING_SITES[0]!;
    const b1 = { ...base, id: `${base.id}-b1`, bortle: 1 as const };
    const b4 = { ...base, id: `${base.id}-b4`, bortle: 4 as const };
    const times = Array.from({ length: 10 }, (_, index) =>
      new Date(Date.parse("2026-09-07T20:00:00Z") + index * 3600000).toISOString().slice(0, 16));
    const values = (value: number) => times.map(() => value);
    const record: FinderWeatherRecord = { status: "available", fetchedAt: new Date().toISOString(), hourly: {
      time: times, cloud_cover: values(10), cloud_cover_low: values(5), cloud_cover_mid: values(5), cloud_cover_high: values(5),
      precipitation: values(0), wind_speed_10m: values(1), wind_gusts_10m: values(2), weather_code: values(0),
      visibility: values(20000), temperature_2m: values(15),
    } };
    const hourB1 = scoreObservingSiteAtTime(b1, record, times[0]);
    const hourB4 = scoreObservingSiteAtTime(b4, record, times[0]);
    expect(hourB1.score).not.toBeNull();
    expect(hourB1.score).toBe(hourB4.score);
    expect(hourB1.darkness).toBeNull();
    expect(hourB4.darkness).toBeNull();
    const nightB1 = scoreObservingSite(b1, record, "2026-09-07");
    const nightB4 = scoreObservingSite(b4, record, "2026-09-07");
    expect(nightB1.score).not.toBeNull();
    expect(nightB1.score).toBe(nightB4.score);
    expect(nightB1.darkness).toBeNull();
    expect(nightB4.darkness).toBeNull();
  });
});
