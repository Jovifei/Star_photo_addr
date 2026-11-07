import { describe, expect, it } from "vitest";
import { astroChartYMin } from "@/components/LocationDetailCharts";
import type { HourEvaluation } from "@/lib/types";

// Regression (2026-11-07 review): the astro chart's y-axis floor was fixed at
// −40° while sun/moon altitudes routinely reach −70° at night; the lines were
// clipped invisibly while tooltips still reported the true values.
function hour(sunAltitude: number, moonAltitude: number, galacticAltitude: number): HourEvaluation {
  return { sunAltitude, moonAltitude, galacticAltitude } as unknown as HourEvaluation;
}

describe("astroChartYMin", () => {
  it("keeps the −40° floor when nothing dips below it", () => {
    expect(astroChartYMin([hour(-35, -10, 20), hour(5, -39, 0)])).toBe(-40);
  });

  it("extends the floor in 10° steps to cover a −73° sun", () => {
    expect(astroChartYMin([hour(-73, -20, 10)])).toBe(-80);
  });

  it("covers a deep galactic-core dip", () => {
    expect(astroChartYMin([hour(-10, -5, -55)])).toBe(-60);
  });

  it("never extends past −90°", () => {
    expect(astroChartYMin([hour(-95, -92, -91)])).toBe(-90);
  });
});
