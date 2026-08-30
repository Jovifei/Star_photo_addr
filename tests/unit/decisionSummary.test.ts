import { describe, expect, it } from "vitest";
import { buildDecisionSummary } from "@/lib/decisionSummary";
import type { Location, NightEvaluation } from "@/lib/types";

const location: Location = {
  id: "custom-30.46940-119.59780",
  name: "天荒坪",
  latitude: 30.4694,
  longitude: 119.5978,
  elevation: 958.4,
  source: "自定义",
};

function evaluation(overrides: Partial<NightEvaluation> = {}): NightEvaluation {
  return {
    nightKey: "2026-08-30",
    score: 49,
    cloudSeaPotential: 20,
    status: "no",
    confidence: { level: "高", kind: "high", reason: "模式一致" },
    hours: [],
    window: [],
    windowLabel: "暂无连续窗口",
    darkHours: 9,
    galacticMax: 30,
    moonIllumination: 0.93,
    moonPhase: "盈凸月",
    blockers: ["雷暴风险", "降水风险"],
    reason: "雷暴风险",
    scoreModelVersion: "test",
    ...overrides,
  };
}

describe("buildDecisionSummary", () => {
  it("guides the user when no location is selected", () => {
    const model = buildDecisionSummary({
      location: null,
      evaluation: null,
      loading: false,
      updatedAt: "2026-08-30T11:00:00+08:00",
    });
    expect(model.kind).toBe("empty");
    expect(model.gradeLabel).toBe("未选地点");
    expect(model.riskText).toContain("点击地图");
    expect(model.riskText).not.toContain("一般");
    expect(model.riskTitle).not.toMatch(/安全|无雷暴/);
  });

  it("says 数据不足 when a location is selected but evaluation is missing", () => {
    const model = buildDecisionSummary({
      location,
      evaluation: null,
      loading: false,
      updatedAt: null,
    });
    expect(model.kind).toBe("unknown");
    expect(model.gradeLabel).toBe("数据不足");
    expect(model.locationName).toBe("天荒坪");
    expect(model.riskTitle).toBe("评分未知");
    expect(model.riskText).not.toMatch(/一般|安全|无主要安全门禁/);
  });

  it("lists real blockers and never claims safety when blockers are empty", () => {
    const blocked = buildDecisionSummary({
      location,
      evaluation: evaluation(),
      loading: false,
      updatedAt: "2026-08-30T11:00:00+08:00",
    });
    expect(blocked.kind).toBe("ready");
    expect(blocked.gradeLabel).toBe("不建议");
    expect(blocked.riskTitle).toBe("主要风险");
    expect(blocked.riskText).toContain("雷暴风险");
    expect(blocked.updatedLabel).toContain("11:00");

    const clear = buildDecisionSummary({
      location,
      evaluation: evaluation({
        status: "go",
        score: 88,
        blockers: [],
        reason: "窗口成立",
        windowLabel: "22:00–01:00",
      }),
      loading: false,
      updatedAt: "2026-08-30T11:00:00+08:00",
    });
    expect(clear.gradeLabel).toBe("推荐");
    expect(clear.riskTitle).toBe("未见已接入门禁");
    expect(clear.riskText).toContain("降水");
    expect(clear.riskText).toContain("当地预警");
    expect(clear.riskText).not.toMatch(/安全|无雷暴|无主要安全门禁/);
  });
});
