import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CloudSeaSiteDetail from "@/app/cloudsea/CloudSeaSiteDetail";
import { CLOUD_SEA_EMPTY_WINDOW, type CloudSeaWindowScore } from "@/lib/cloudsea";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";

function detail(overrides: Partial<CloudSeaWindowScore>) {
  return renderToStaticMarkup(createElement(CloudSeaSiteDetail, {
    site: CLOUD_SEA_SITES[0], phase: "morning", dateKey: "2026-10-22", onClose: () => {},
    window: { ...CLOUD_SEA_EMPTY_WINDOW, ...overrides },
  })).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("cloud-sea window statistics disclosure", () => {
  it("shows a cloud-top interval rather than an invented exact top",()=>{
    const text=detail({cloudPosition:"above",cloudTopM:750,cloudTopUpperM:1000,altitudeDiffM:910,pressureStatus:"available"});
    expect(text).toContain("750–1000 m");
    expect(text).toContain("至少高出");
  });
  it("distinguishes available pressure data from unresolved summit geometry",()=>{
    const text=detail({cloudPosition:"unknown",pressureStatus:"available"});
    expect(text).toContain("山顶层位仍待解析");
    expect(text).not.toContain("缺失 pressure");
  });
  it("corrects legacy in-cloud wording throughout the detail", () => {
    const text = detail({ cloudPosition: "in", cloudBaseM: 1550, cloudTopM: 1550,
      cloudTopUpperM: 2070, altitudeDiffM: -61, score: 22, pressureStatus: "available",
      positionLabel: "山顶处于云层内",
      summary: "数值模式压力剖面显示山顶海拔（1489m）落在低层云 deck（1550–1550m）内，存在云雾包裹风险。" });
    expect(text).toContain("山顶接近或可能处于云层");
    expect(text).toContain("上下各150m余量");
    expect(text).toContain("采样高度并非云体的实测边界");
    expect(text).toContain("有云采样高度跨度");
    expect(text).not.toContain("山顶处于云层内");
    expect(text).not.toContain("落在低层云 deck");
    expect(text).not.toContain("峰顶-云顶");
  });
  it("distinguishes the window mean from a short high-scoring hour", () => {
    const text = detail({ score: 31, conditionLabel: "31/100", peakTime: "05:00", peakScore: 98,
      coverage: { expectedHours: 4, surfaceValidHours: 4, scoreableHours: 4, pressureHours: 4 } });
    expect(text).toContain("窗口平均");
    expect(text).toContain("31/100");
    expect(text).toContain("最佳 05:00 · 98/100");
    expect(text).toContain("天气 4/4 时");
  });

  it("retains one known hour without presenting it as a complete window", () => {
    const text = detail({ peakTime: "05:00", peakScore: 98,
      coverage: { expectedHours: 4, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 1 } });
    expect(text).toContain("窗口覆盖不足");
    expect(text).toContain("天气 1/4 时");
    expect(text).toContain("可评分 1/4 时");
    expect(text).toContain("最佳 05:00 · 98/100");
  });

  it("does not invent coverage or a peak score for a legacy response", () => {
    const text = detail({ score: 31, conditionLabel: "31/100", peakTime: "05:00", coverage: undefined, peakScore: undefined });
    expect(text).toContain("覆盖时次未知");
    expect(text).not.toContain("天气 0/0");
    expect(text).not.toContain("05:00 · 31/100");
  });
});
