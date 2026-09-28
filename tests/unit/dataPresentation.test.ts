import { describe, expect, it } from "vitest";
import { presentProviderHealth, presentRecommendationEligibility, presentSelectedData } from "@/lib/dataPresentation";
import type { DataSourceProbe } from "@/lib/dataSourceStatus";

const source = (status: DataSourceProbe["status"]): DataSourceProbe => ({
  id: "weather",
  label: "Open-Meteo 云量",
  status,
  detail: "probe detail",
  checkedAt: "2026-09-28T00:00:00.000Z",
});

describe("data presentation contract", () => {
  it.each([
    [undefined, "loading"],
    [source("available"), "available"],
    [source("degraded"), "degraded"],
    [source("unconfigured"), "unconfigured"],
    [source("not-installed"), "not-installed"],
  ])("maps provider status without making optional sources errors", (value, code) => {
    const state = presentProviderHealth(value);
    expect(state.code).toBe(code);
    if (code === "unconfigured" || code === "not-installed") expect(state.tone).toBe("neutral");
  });

  it("keeps selected data validity independent from provider health", () => {
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: true, availabilityError: null, staleInUse: false, forecastIssue: null, hasEvaluation: true }).code).toBe("ready");
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: true, availabilityError: null, staleInUse: false, forecastIssue: null, hasEvaluation: false }).code).toBe("partial");
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: true, availabilityError: null, staleInUse: false, forecastIssue: "天气数据已降级或过期，不发布推荐分", hasEvaluation: true }).code).toBe("stale");
  });

  it("maps recommendation eligibility without using provider status", () => {
    expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: true, forecastIssue: null, availabilityError: null }).code).toBe("eligible");
    expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: false, forecastIssue: null, availabilityError: null }).code).toBe("withheld");
    expect(presentRecommendationEligibility({ hasLocation: false, loading: false, hasForecast: false, hasEvaluation: false, forecastIssue: null, availabilityError: null }).code).toBe("waiting");
  });
});
