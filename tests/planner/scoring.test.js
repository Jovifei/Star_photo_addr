import { describe, expect, it } from "vitest";
import { evaluateHour } from "../../src/features/planner/lib/scoring.js";

const location = { latitude: 30.026, longitude: 119.007, elevation: 1489.9 };
const good = {
  time: "2026-08-12T02:00",
  temperature: 12,
  dewPoint: 5,
  humidity: 55,
  precipitationProbability: 0,
  precipitation: 0,
  weatherCode: 0,
  cloudCover: 5,
  cloudLow: 3,
  cloudMid: 5,
  cloudHigh: 7,
  visibility: 30000,
  windSpeed: 2,
  windGust: 4,
};

describe("star photography score", () => {
  it("gives a clear dry calm hour a strong score", () => {
    const result = evaluateHour(good, location);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.blockers).toEqual([]);
  });

  it("hard-blocks thunderstorms, rain and severe gusts", () => {
    const result = evaluateHour(
      { ...good, weatherCode: 95, precipitation: 1.2, precipitationProbability: 90, windGust: 18 },
      location,
    );
    expect(result.quality).toBe("blocked");
    expect(result.blockers).toEqual(expect.arrayContaining(["雷暴风险", "降水风险", "阵风过大"]));
  });
});
