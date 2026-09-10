import { describe, expect, it } from "vitest";
import { filterByScoreThreshold } from "@/lib/scoreThreshold";

describe("score threshold filtering", () => {
  const entries = [
    { id: "perfect", score: 100 },
    { id: "good", score: 60 },
    { id: "weak", score: 50 },
    { id: "unknown", score: null },
  ];

  it("keeps only scored locations at or above the selected threshold", () => {
    expect(filterByScoreThreshold(entries, 0).map((entry) => entry.id)).toEqual([
      "perfect",
      "good",
      "weak",
    ]);
    expect(filterByScoreThreshold(entries, 60).map((entry) => entry.id)).toEqual([
      "perfect",
      "good",
    ]);
    expect(filterByScoreThreshold(entries, 100).map((entry) => entry.id)).toEqual([
      "perfect",
    ]);
  });

  it("clamps invalid thresholds to the 0–100 range", () => {
    expect(filterByScoreThreshold(entries, -10)).toHaveLength(3);
    expect(filterByScoreThreshold(entries, 120)).toHaveLength(1);
  });
});
