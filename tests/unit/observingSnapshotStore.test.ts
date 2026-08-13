import { describe, expect, it } from "vitest";
import { isObservationSnapshot } from "@/lib/observingSnapshotStore";

const SCORE = {
  score: 82,
  band: "recommended",
  cloud: 18,
  darkness: 75,
  weatherRisk: 90,
  bestWindow: "22:00–01:00",
  blockers: [],
  confidence: "high",
  validHours: 10,
};

describe("observation snapshot validation", () => {
  it("accepts complete snapshots and rejects malformed nested scores", () => {
    const snapshot = {
      date: "2026-08-13",
      days: 1,
      model: "icon",
      generatedAt: "2026-08-13T00:00:00.000Z",
      source: "test",
      stale: false,
      sites: { site: [SCORE] },
    };
    expect(isObservationSnapshot(snapshot)).toBe(true);
    expect(isObservationSnapshot({ ...snapshot, sites: { site: [{ ...SCORE, blockers: "rain" }] } })).toBe(false);
    expect(isObservationSnapshot({ ...snapshot, sites: { site: [] } })).toBe(false);
  });
});
