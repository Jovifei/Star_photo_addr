// @vitest-environment jsdom
import { createElement, Fragment } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useCandidateForecasts", () => ({ useCandidateForecasts: () => null }));
vi.mock("@/components/ResponsiveMapControls", () => ({ useMobilePanelViewport: () => false }));
vi.mock("@/lib/store", () => ({
  cachedForecast: () => null,
  useStore: () => ({ state: {
    candidates: [], nightKeys: ["2026-10-05"], forecastCache: {},
    selectedLocation: null, forecast: null, candidateForecastModel: "best_match",
  } }),
}));
import HourlyForecastMatrix from "@/components/HourlyForecastMatrix";
import StarWindowTable from "@/components/StarWindowTable";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
afterEach(cleanup);
describe("workspace accessible table and landmark names", () => {
  it("names the candidate action column without inventing a data value", () => {
    render(createElement(StarWindowTable));
    const header = screen.getByRole("columnheader", { name: "候选操作" });
    expect(header.getAttribute("scope")).toBe("col");
    expect(header.querySelector(".sr-only")?.textContent).toBe("候选操作");
  });
  it("distinguishes sidebars by purpose", () => {
    render(createElement(WorkspaceShell, {
      header: null, input: "候选数据", canvas: "地图", inspectorPanes: { summary: "观测证据" },
    }));
    expect(screen.getByRole("complementary", { name: "候选地点与观测计划" }).textContent).toContain("候选数据");
    expect(screen.getByRole("complementary", { name: "观测数据与证据" }).textContent).toContain("观测证据");
  });
  it("distinguishes hourly scroll regions by title and night while retaining keyboard access", () => {
    render(createElement(Fragment, null,
      ...[
        ["单夜小时预报", "2026-10-05"],
        ["逐小时气象与云量详情", "2026-10-05"],
        ["单夜小时预报", "2026-10-06"],
      ].map(([title, nightKey]) => createElement(HourlyForecastMatrix, {
        key: `${title}-${nightKey}`, title, nightKey, hours: [], onSelectTime: vi.fn(),
      })),
    ));
    for (const name of [
      "单夜小时预报，2026-10-05，逐小时参数，可上下及左右滚动",
      "逐小时气象与云量详情，2026-10-05，逐小时参数，可上下及左右滚动",
      "单夜小时预报，2026-10-06，逐小时参数，可上下及左右滚动",
    ]) expect(screen.getByRole("region", { name }).tabIndex).toBe(0);
  });
});
