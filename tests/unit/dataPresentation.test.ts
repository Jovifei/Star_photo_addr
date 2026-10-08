import { describe, expect, it } from "vitest";
import { presentHourlyDataValidity, presentMapRecommendationEligibility, presentProviderHealth, presentRecommendationEligibility, presentSelectedData } from "@/lib/dataPresentation";
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
    expect(presentSelectedData({ hasLocation: true, loading: true, hasForecast: false, availabilityError: null, staleInUse: false, forecastIssue: "暂无天气数据", hasEvaluation: false }).code).toBe("loading");
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: false, availabilityError: "HTTP 429", staleInUse: false, forecastIssue: "暂无天气数据", hasEvaluation: false }).code).toBe("unavailable");
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: true, availabilityError: null, staleInUse: true, forecastIssue: "天气数据模型与当前选择不一致，不发布推荐分", hasEvaluation: false }).code).toBe("invalid");
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: true, availabilityError: null, staleInUse: true, forecastIssue: null, hasEvaluation: false }).code).toBe("stale");
    expect(presentSelectedData({ hasLocation: true, loading: false, hasForecast: true, availabilityError: null, staleInUse: false, forecastIssue: "天气数据缺少模型身份，不发布推荐分", hasEvaluation: false }).code).toBe("invalid");
  });

  it("maps recommendation eligibility without using provider status", () => {
    expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: true, forecastIssue: null, availabilityError: null }).code).toBe("eligible");
    expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: false, forecastIssue: null, availabilityError: null }).code).toBe("withheld");
    expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: false, forecastIssue: "天气数据模型与当前选择不一致，不发布推荐分", availabilityError: null }).code).toBe("withheld");
    expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: false, forecastIssue: "天气数据已降级或过期，不发布推荐分", availabilityError: null }).code).toBe("withheld");
    expect(presentRecommendationEligibility({ hasLocation: false, loading: false, hasForecast: false, hasEvaluation: false, forecastIssue: null, availabilityError: null }).code).toBe("waiting");
  });

  it("maps hourly field completeness without calculating integrity", () => {
    expect(presentHourlyDataValidity({ hasSource: false, stale: false, hasHour: false, missingFields: [] }).code).toBe("unavailable");
    expect(presentHourlyDataValidity({ hasSource: true, stale: true, hasHour: true, missingFields: [] }).code).toBe("stale");
    expect(presentHourlyDataValidity({ hasSource: true, stale: false, hasHour: false, missingFields: [] }).code).toBe("partial");
    expect(presentHourlyDataValidity({ hasSource: true, stale: false, hasHour: true, missingFields: ["能见度"] }).detail).toContain("能见度");
    expect(presentHourlyDataValidity({ hasSource: true, stale: false, hasHour: true, missingFields: [] }).code).toBe("ready");
  });

  it("maps map snapshot eligibility from existing publishable counts", () => {
    expect(presentMapRecommendationEligibility({ loading: true, requestFailed: false, hasSnapshot: false, stale: false, publishableCount: 0 }).code).toBe("waiting");
    expect(presentMapRecommendationEligibility({ loading: false, requestFailed: true, hasSnapshot: false, stale: false, publishableCount: 0 }).code).toBe("withheld");
    expect(presentMapRecommendationEligibility({ loading: false, requestFailed: false, hasSnapshot: true, stale: true, publishableCount: 4 }).code).toBe("withheld");
    expect(presentMapRecommendationEligibility({ loading: false, requestFailed: false, hasSnapshot: true, stale: false, publishableCount: 0 }).code).toBe("withheld");
    expect(presentMapRecommendationEligibility({ loading: false, requestFailed: false, hasSnapshot: true, stale: false, publishableCount: 4 }).code).toBe("eligible");
  });
});

it("withholds a retained evaluated forecast after its explicit refresh failed", () => {
  expect(presentRecommendationEligibility({ hasLocation: true, loading: false, hasForecast: true, hasEvaluation: true, forecastIssue: null, availabilityError: "HTTP 429" }).code).toBe("withheld");
});
