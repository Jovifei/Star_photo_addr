import { describe, expect, it } from "vitest";
import { SCORING_REQUIRED_SERIES, missingScoringSeries } from "@/lib/forecastPolicy";

const complete = (): Record<string, unknown> => ({ time: ["2026-10-02T20:00", "2026-10-02T21:00"], ...Object.fromEntries(SCORING_REQUIRED_SERIES.map(([key]) => [key, [0, 0]])) });
describe("scoring probe capability", () => {
  it("requires one complete aligned hour instead of disjoint available series", () => {
    const payload = complete();
    payload.visibility = [0, null];
    payload.precipitation = [null, 0];
    expect(missingScoringSeries(payload)).toEqual(["同一时次的完整评分字段"]);
  });
  it("rejects duplicate or reversed times", () => {
    expect(missingScoringSeries({ ...complete(), time: ["2026-10-02T20:00", "2026-10-02T20:00"] })).toEqual(["有效且唯一的逐小时时间轴"]);
    expect(missingScoringSeries({ ...complete(), time: ["2026-10-02T21:00", "2026-10-02T20:00"] })).toEqual(["有效且唯一的逐小时时间轴"]);
  });
});
