import { describe, expect, it } from "vitest";
import {
  dominantProvince,
  rankViewportRecommendations,
  recommendationReason,
  scoreToStars,
  siteInsideViewport,
  type MapViewport,
} from "@/lib/viewportRecommendations";
import type {
  ObservationSnapshot,
  ObservingSite,
  RecommendationScore,
} from "@/lib/types";

const sites: ObservingSite[] = [
  {
    id: "a",
    name: "清凉峰",
    province: "浙江",
    area: "临安",
    latitude: 30.15,
    longitude: 118.9,
    altitude: 1787,
    bortle: 2,
    description: "浙江西部高海拔暗夜点",
  },
  {
    id: "b",
    name: "天荒坪",
    province: "浙江",
    area: "安吉",
    latitude: 30.47,
    longitude: 119.6,
    altitude: 958,
    bortle: 3,
    description: "交通相对便利",
  },
  {
    id: "c",
    name: "川西测试点",
    province: "四川",
    area: "甘孜",
    latitude: 30.1,
    longitude: 100.2,
    altitude: 3800,
    bortle: 1,
  },
];

function score(
  value: number | null,
  band: RecommendationScore["band"],
  cloud: number | null,
): RecommendationScore {
  return {
    score: value,
    band,
    cloud,
    darkness: 90,
    weatherRisk: 90,
    bestWindow: null,
    blockers: [],
    confidence: value == null ? "unknown" : "high",
    validHours: value == null ? 0 : 1,
  };
}

const snapshot: ObservationSnapshot = {
  date: "2026-08-20",
  days: 1,
  model: "gfs",
  generatedAt: "2026-08-20T12:00:00Z",
  source: "test",
  stale: false,
  sites: {},
  focusTime: "2026-08-20T22:00",
  focusScores: {
    a: score(88, "priority", 12),
    b: score(74, "recommended", 28),
    c: score(92, "priority", 8),
  },
};

const zhejiangViewport: MapViewport = {
  north: 31,
  south: 27,
  west: 117,
  east: 123,
  zoom: 7,
};

describe("viewport recommendation ranking", () => {
  it("filters by bounds and ranks by the current observation score", () => {
    const result = rankViewportRecommendations(sites, snapshot, zhejiangViewport, {
      bortleLimit: 4,
      recommendationThreshold: 70,
      recommendedOnly: false,
      visibleBands: ["priority", "recommended", "watch", "not-recommended"],
    });
    expect(result.map((item) => item.site.id)).toEqual(["a", "b"]);
    expect(result.map((item) => item.rank)).toEqual([1, 2]);
    expect(result[0]?.stars).toBe(5);
    expect(result[0]?.reason).toContain("云量较低");
  });

  it("respects the score threshold and visible recommendation bands", () => {
    expect(
      rankViewportRecommendations(sites, snapshot, zhejiangViewport, {
        bortleLimit: 4,
        recommendationThreshold: 80,
        recommendedOnly: true,
        visibleBands: ["priority"],
      }).map((item) => item.site.id),
    ).toEqual(["a"]);
  });

  it("handles antimeridian-crossing bounds", () => {
    const viewport: MapViewport = {
      north: 20,
      south: -20,
      west: 170,
      east: -170,
      zoom: 7,
    };
    expect(
      siteInsideViewport({ latitude: 0, longitude: 179 }, viewport),
    ).toBe(true);
    expect(
      siteInsideViewport({ latitude: 0, longitude: -179 }, viewport),
    ).toBe(true);
    expect(
      siteInsideViewport({ latitude: 0, longitude: 0 }, viewport),
    ).toBe(false);
  });

  it("maps scores to five-star display without inventing a score for missing data", () => {
    expect(scoreToStars(90)).toBe(5);
    expect(scoreToStars(72)).toBe(4);
    expect(scoreToStars(58)).toBe(3);
    expect(scoreToStars(41)).toBe(2);
    expect(scoreToStars(20)).toBe(1);
    expect(scoreToStars(null)).toBe(0);
  });

  it("uses blockers and site descriptions as grounded reasons", () => {
    const blocked = {
      ...score(20, "not-recommended", 90),
      blockers: ["雷暴风险"],
    };
    expect(recommendationReason(sites[0]!, blocked)).toBe("雷暴风险");
    expect(recommendationReason(sites[0]!, null)).toBe("浙江西部高海拔暗夜点");
  });

  it("summarizes the dominant province", () => {
    const result = rankViewportRecommendations(sites, snapshot, zhejiangViewport, {
      bortleLimit: 4,
      recommendationThreshold: 70,
      recommendedOnly: false,
      visibleBands: ["priority", "recommended", "watch", "not-recommended"],
    });
    expect(dominantProvince(result)).toBe("浙江");
    expect(dominantProvince([])).toBeNull();
  });
});
