import { describe, expect, it } from "vitest";
import { DEFAULT_CLOUD_STATE } from "@/lib/constants";
import { DEFAULT_SCORING_MODEL } from "@/lib/forecastPolicy";
import { forecastQualityLabel } from "@/components/CloudTimeline";

describe("model recovery application wiring", () => {
  it("makes the homepage use the explicit scoring default", () => {
    expect(DEFAULT_SCORING_MODEL).toBe("gfs");
    expect(DEFAULT_CLOUD_STATE.model).toBe(DEFAULT_SCORING_MODEL);
  });
  it("distinguishes cloud viewing from score eligibility", () => {
    expect(forecastQualityLabel("取样点", false, ["能见度"])).toContain("评分数据不足");
    expect(forecastQualityLabel("取样点", false, ["能见度"])).toContain("能见度");
    expect(forecastQualityLabel("取样点", true, ["能见度"])).toBe("过期/降级，禁止推荐");
    expect(forecastQualityLabel("暂无有效预报", false, ["所选时次"])).toBe("数据不足");
    expect(forecastQualityLabel("取样点", false, [])).toBe("可用");
  });
});
