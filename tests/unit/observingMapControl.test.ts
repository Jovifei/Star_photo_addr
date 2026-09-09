import { describe, expect, it } from "vitest";
import { shouldClampActiveForecastTime } from "@/components/ObservingMapControl";

describe("观星评分时间窗口", () => {
  it("保留评分窗口之前但属于当前夜间矩阵的选中时次", () => {
    expect(
      shouldClampActiveForecastTime(
        "2026-09-09T01:00",
        ["2026-09-09T02:00"],
        "2026-09-08",
      ),
    ).toBe(false);
  });

  it("仍将不属于选中夜间的窗口外时次回弹到评分窗口", () => {
    expect(
      shouldClampActiveForecastTime(
        "2026-09-09T12:00",
        ["2026-09-09T02:00"],
        "2026-09-08",
      ),
    ).toBe(true);
  });
});
