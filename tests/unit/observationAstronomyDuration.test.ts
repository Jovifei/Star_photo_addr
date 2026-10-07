import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ObservationDetails from "@/components/ObservationDetails";
import type { Location, NightEvaluation } from "@/lib/types";
import type { NightAstronomyFacts } from "@/lib/nightAstronomyFacts";

const location: Location = { id: "duration", name: "duration", latitude: 30, longitude: 120, elevation: null, source: "自定义" };
const evaluation: NightEvaluation = {
  nightKey: "2026-10-07", score: 80, cloudSeaPotential: 0, status: "no",
  confidence: { level: "高", kind: "high", reason: "fixture" }, hours: [], window: [],
  windowLabel: "20:00–22:00", darkHours: 10, galacticMax: 40,
  moonIllumination: 0.5, moonPhase: "上弦月", blockers: [], reason: "fixture", scoreModelVersion: "test",
};
function durationValue(facts: NightAstronomyFacts | null) {
  const html = renderToStaticMarkup(createElement(ObservationDetails, { sample: null, evaluation, location, astronomyFacts: facts }));
  return /暗夜时长（估算）<\/div><div class="value">([^<]*)/.exec(html)?.[1];
}
describe("independent darkness duration presentation", () => {
  it("does not label the scoring sample count as elapsed hours when facts are unavailable", () => {
    expect(durationValue(null)).toBe("—");
  });
  it("shows the independently integrated duration when present", () => {
    expect(durationValue({ moonIllumination: 0.5, moonPhase: "上弦月", darkHours: 9,
      galacticMax: 40, sampleCount: 10, heightAssumption: "sea-level" })).toBe("9");
  });
});
