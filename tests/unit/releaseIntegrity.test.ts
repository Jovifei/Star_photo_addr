import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("release integrity invariants", () => {
  it("does not ship synthetic cloudsea weather or nearby-disk forecast relabelling", () => {
    const cloudseaRoute = fs.readFileSync("src/app/api/cloudsea/snapshot/route.ts", "utf8");
    const forecastRoute = fs.readFileSync("src/app/api/forecast/route.ts", "utf8");
    expect(cloudseaRoute).not.toContain("generateFallbackWeather");
    expect(cloudseaRoute).not.toContain("using resilient fallback");
    expect(forecastRoute).not.toContain("findNearestDiskForecast");
  });

  it("never labels the selected forecast valid time as the data update time", () => {
    const summary = fs.readFileSync("src/components/workspace/DecisionSummary.tsx", "utf8");
    expect(summary).not.toContain("state.cloudState.activeForecastTime ??");
    expect(summary).toContain("state.forecastAvailability.lastSuccessAt");
  });
});
