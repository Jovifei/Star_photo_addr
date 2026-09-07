import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  OBSERVING_SITES,
  scoreObservingSite,
  scoreObservingSiteAtTime,
} from "@/lib/observingSites";
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

  it("keeps catalog Bortle out of candidate placeholder scores and user-visible candidate metadata", () => {
    const source = fs.readFileSync("src/components/CandidateList.tsx", "utf8");
    expect(source).not.toContain("FINDER_LOCATIONS");
    expect(source).not.toContain("cand.bortle");
    expect(source).not.toContain("candidate.bortle");
    expect(source).not.toContain("Baseline estimation based on Bortle");
    expect(source).toContain("score: null");
    expect(source).toContain("Do not fabricate a placeholder score");
  });

  it("labels B1-B4 site-library filters as catalog reference rather than measurement", () => {
    const source = fs.readFileSync("src/components/BortleFilterBar.tsx", "utf8");
    expect(source).toContain("目录参考暗空级别");
    expect(source).toContain("参考 B");
    expect(source).toContain("不是当前栅格或现场 SQM 实测");
  });

  it("gives identical live scores for identical weather regardless of catalog Bortle", () => {
    const base = OBSERVING_SITES[0]!;
    const referenceB1 = { ...base, id: `${base.id}-b1`, bortle: 1 as const };
    const referenceB4 = { ...base, id: `${base.id}-b4`, bortle: 4 as const };
    const times = [
      "2026-09-07T20:00",
      "2026-09-07T21:00",
      "2026-09-07T22:00",
      "2026-09-07T23:00",
      "2026-09-08T00:00",
      "2026-09-08T01:00",
      "2026-09-08T02:00",
      "2026-09-08T03:00",
      "2026-09-08T04:00",
      "2026-09-08T05:00",
    ];
    const values = (value: number) => times.map(() => value);
    const record = {
      status: "available",
      hourly: {
        time: times,
        cloud_cover: values(10),
        precipitation: values(0),
        wind_speed_10m: values(1),
        wind_gusts_10m: values(2),
        weather_code: values(0),
      },
    } as unknown as FinderWeatherRecord;

    const hourB1 = scoreObservingSiteAtTime(
      referenceB1,
      record,
      "2026-09-07T20:00",
    );
    const hourB4 = scoreObservingSiteAtTime(
      referenceB4,
      record,
      "2026-09-07T20:00",
    );
    expect(hourB1.score).toBe(hourB4.score);
    expect(hourB1.darkness).toBeNull();
    expect(hourB4.darkness).toBeNull();

    const nightB1 = scoreObservingSite(
      referenceB1,
      record,
      "2026-09-07",
    );
    const nightB4 = scoreObservingSite(
      referenceB4,
      record,
      "2026-09-07",
    );
    expect(nightB1.score).toBe(nightB4.score);
    expect(nightB1.darkness).toBeNull();
    expect(nightB4.darkness).toBeNull();
  });
});
