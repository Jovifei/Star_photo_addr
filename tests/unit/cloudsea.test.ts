import { describe, expect, it } from "vitest";
import {
  estimateCloudLayers,
  evaluateCloudSeaWindow,
  probabilityLevelFor,
  positionLabel,
  positionBadgeTone,
  buildCloudSeaSnapshot,
} from "@/lib/cloudsea";
import {
  interpolateScoreGrid,
  levelIndexFor,
  CLOUD_SEA_LEVEL_THRESHOLDS,
} from "@/lib/cloudseaOverlay";
import type { CloudSeaSite } from "@/lib/cloudseaSites";

const MOCK_HIGH_SITE: CloudSeaSite = {
  id: "test-niubei",
  name: "牛背山",
  province: "四川",
  area: "雅安",
  latitude: 29.74,
  longitude: 102.32,
  altitude: 3660,
  viewpoint: "观景平台",
  description: "测试高山点位",
};

const MOCK_LOW_SITE: CloudSeaSite = {
  id: "test-low",
  name: "平原低地",
  province: "江苏",
  area: "南京",
  latitude: 32.0,
  longitude: 118.8,
  altitude: 200,
  viewpoint: "平原",
  description: "测试低海拔点位",
};

describe("estimateCloudLayers", () => {
  it("calculates cloud base and top higher than valley floor", () => {
    const { baseM, topM } = estimateCloudLayers(1800, 75, 14, 2.0);
    expect(baseM).toBeGreaterThan(50);
    expect(topM).toBeGreaterThan(baseM);
  });

  it("expands cloud thickness when low cloud percentage is high", () => {
    const thin = estimateCloudLayers(2000, 30, 10, 2.0);
    const thick = estimateCloudLayers(2000, 90, 10, 2.0);
    expect(thick.topM - thick.baseM).toBeGreaterThan(thin.topM - thin.baseM);
  });
});

describe("evaluateCloudSeaWindow", () => {
  it("identifies high mountain above cloud sea with strong score", () => {
    const hourly = {
      time: [
        "2026-09-04T05:00:00",
        "2026-09-04T06:00:00",
        "2026-09-04T07:00:00",
        "2026-09-04T08:00:00",
      ],
      cloud_cover_low: [80, 85, 80, 75],
      cloud_cover_mid: [5, 10, 5, 5],
      cloud_cover_high: [10, 10, 15, 10],
      temperature_2m: [8, 8, 9, 11],
      wind_speed_10m: [1.8, 1.5, 2.0, 2.2],
      precipitation: [0, 0, 0, 0],
    };

    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [5, 6, 7, 8]);
    expect(result.cloudPosition).toBe("above");
    expect(result.positionLabel).toBe("云上海拔");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(["p80", "p90", "p100"]).toContain(result.probabilityLevel);
    expect(result.altitudeDiffM).toBeGreaterThan(0);
  });

  it("identifies low elevation site as below clouds or low score", () => {
    const hourly = {
      time: [
        "2026-09-04T05:00:00",
        "2026-09-04T06:00:00",
        "2026-09-04T07:00:00",
      ],
      cloud_cover_low: [80, 80, 85],
      cloud_cover_mid: [50, 50, 60],
      cloud_cover_high: [30, 30, 40],
      temperature_2m: [18, 18, 19],
      wind_speed_10m: [3.5, 4.0, 3.8],
      precipitation: [0, 0, 0],
    };

    const result = evaluateCloudSeaWindow(MOCK_LOW_SITE, hourly, [5, 6, 7]);
    expect(result.cloudPosition).toBe("below");
    expect(result.positionLabel).toBe("云下阴天");
    expect(result.score).toBeLessThanOrEqual(35);
  });

  it("identifies clear skies when low cloud is minimal", () => {
    const hourly = {
      time: ["2026-09-04T06:00:00"],
      cloud_cover_low: [5],
      cloud_cover_mid: [0],
      cloud_cover_high: [5],
      temperature_2m: [15],
      wind_speed_10m: [1.5],
      precipitation: [0],
    };

    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [6]);
    expect(result.cloudPosition).toBe("clear");
    expect(result.positionLabel).toBe("晴朗少云");
    expect(result.score).toBeLessThanOrEqual(25);
  });
});

describe("probabilityLevelFor and position helpers", () => {
  it("maps score thresholds correctly", () => {
    expect(probabilityLevelFor(10)).toBe("p20");
    expect(probabilityLevelFor(35)).toBe("p40");
    expect(probabilityLevelFor(55)).toBe("p60");
    expect(probabilityLevelFor(75)).toBe("p80");
    expect(probabilityLevelFor(85)).toBe("p90");
    expect(probabilityLevelFor(95)).toBe("p100");
  });

  it("returns appropriate badge tones", () => {
    expect(positionBadgeTone("above")).toBe("good");
    expect(positionBadgeTone("in")).toBe("bad");
    expect(positionBadgeTone("below")).toBe("warn");
    expect(positionBadgeTone("clear")).toBe("muted");
  });
});

describe("cloudseaOverlay IDW grid", () => {
  it("interpolates score grid without crashing", () => {
    const points = [
      { latitude: 30.1, longitude: 118.1, score: 85 },
      { latitude: 29.7, longitude: 102.3, score: 92 },
      { latitude: 36.2, longitude: 117.1, score: 65 },
    ];
    const grid = interpolateScoreGrid(points, 50, 40);
    expect(grid).toBeInstanceOf(Float32Array);
    expect(grid.length).toBe(50 * 40);

    // Points near known locations should have values
    const nonNanCount = Array.from(grid).filter((v) => !Number.isNaN(v)).length;
    expect(nonNanCount).toBeGreaterThan(0);
  });

  it("maps overlay level thresholds correctly", () => {
    expect(levelIndexFor(15)).toBe(0);
    expect(levelIndexFor(25)).toBe(1);
    expect(levelIndexFor(95)).toBe(5);
  });
});
