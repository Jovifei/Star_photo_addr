import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { rankViewportRecommendations } from "@/lib/viewportRecommendations";
import type {
  ObservationSnapshot,
  ObservingSite,
  RecommendationScore,
} from "@/lib/types";

function score(value = 80): RecommendationScore {
  return {
    score: value,
    band: "recommended",
    cloud: 20,
    darkness: null,
    weatherRisk: 90,
    bestWindow: null,
    blockers: [],
    confidence: "high",
    validHours: 1,
  };
}

describe("viewport dark-sky trust boundary", () => {
  it("keeps catalog Bortle out of live ranking and recommendation reasons", () => {
    const ranking = fs.readFileSync("src/lib/viewportRecommendations.ts", "utf8");
    expect(ranking).not.toContain("left.site.bortle - right.site.bortle");
    expect(ranking).not.toContain("site.bortle <= 2");
    expect(ranking).not.toContain("暗夜基础突出");
  });

  it("labels viewport Bortle values as reference metadata", () => {
    const panel = fs.readFileSync(
      "src/components/ViewportRecommendationPanel.tsx",
      "utf8",
    );
    const markers = fs.readFileSync(
      "src/components/ViewportRecommendationMarkers.tsx",
      "utf8",
    );
    expect(panel).toContain("参考 B");
    expect(panel).toContain("不进入实时分、星级或推荐理由");
    expect(panel).not.toContain("按当前时次观星分、Bortle 与海拔排序");
    expect(markers).toContain("参考 B");
  });

  it("uses catalog Bortle only as an explicit filter, never as a tie-break", () => {
    const sites: ObservingSite[] = [
      {
        id: "b1-low",
        name: "参考B1低海拔",
        province: "测试",
        area: "A",
        latitude: 30,
        longitude: 120,
        altitude: 500,
        bortle: 1,
      },
      {
        id: "b4-high",
        name: "参考B4高海拔",
        province: "测试",
        area: "B",
        latitude: 30.1,
        longitude: 120.1,
        altitude: 2000,
        bortle: 4,
      },
    ];
    const snapshot: ObservationSnapshot = {
      date: "2026-09-07",
      days: 1,
      model: "icon",
      generatedAt: "2026-09-07T12:00:00Z",
      source: "test",
      stale: false,
      sites: {},
      focusTime: "2026-09-07T20:00",
      focusScores: {
        "b1-low": score(),
        "b4-high": score(),
      },
    };
    const result = rankViewportRecommendations(
      sites,
      snapshot,
      {
        north: 31,
        south: 29,
        east: 121,
        west: 119,
        zoom: 7,
      },
      {
        bortleLevels: [1, 4],
        recommendationThreshold: 70,
        recommendedOnly: false,
        visibleBands: ["recommended"],
      },
    );

    // Same live score/band: altitude is the tie-break. If catalog Bortle leaked
    // back into ranking, the B1 site would incorrectly win this tie.
    expect(result.map((item) => item.site.id)).toEqual(["b4-high", "b1-low"]);
  });
});
