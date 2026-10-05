// @vitest-environment jsdom
import { createElement, Fragment, useCallback, useLayoutEffect, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CLOUD_STATE } from "@/lib/constants";
import { forecastTimeWindow } from "@/lib/nighttime";
import type { CloudState } from "@/lib/types";
import type { useStore } from "@/lib/store";

type StoreValue = ReturnType<typeof useStore>;
const store = vi.hoisted(() => ({ current: null as StoreValue | null }));
vi.mock("@/lib/store", () => ({ useStore: () => store.current! }));
vi.mock("@/components/BortleFilterBar", () => ({ default: () => null }));
import CloudTimeline from "@/components/CloudTimeline";
import RecommendationQuickControls from "@/components/RecommendationQuickControls";
import ObservingMapControl from "@/components/ObservingMapControl";

function Harness({ start = "2026-10-05T12:00", night = "2026-10-05", omit = "", sourceStart = "2026-10-05T00:00" }: { start?: string; night?: string; omit?: string; sourceStart?: string }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [state, setState] = useState(() => ({
    forecastWindowStart: start,
    selectedNight: night,
    selectedLocation: null,
    mapWorkspace: "tonight",
    cloudState: { ...DEFAULT_CLOUD_STATE, range: 7, activeForecastTime: start } as CloudState,
    forecast: {
      hourly: forecastTimeWindow(sourceStart, 240).filter(time => time !== omit).map(time => ({ time, ...(time === "2026-10-05T20:00" ? { cloudCover: 25 } : {}) })),
      metadata: { model: "icon", stale: false },
      fetchedAt: "2026-10-05T04:00:00Z",
    },
    cloudGrid: null,
    cloudGridLoading: false,
    satelliteFrames: [],
    recommendationThreshold: 70,
    recommendedOnly: false,
    observingBortleLevels: [1, 2, 3],
    visibleRecommendationBands: ["priority", "recommended", "watch", "not-recommended"],
  }));
  const setCloud = useCallback((partial: Partial<CloudState>) => setState(value => ({ ...value, cloudState: { ...value.cloudState, ...partial } })), []);
  const selectNight = useCallback((selectedNight: string) => setState(value => ({ ...value, selectedNight })), []);
  store.current = { state, setCloud, selectNight, setRecommendationThreshold: () => undefined, setRecommendedOnly: () => undefined } as unknown as StoreValue;
  return createElement(Fragment, null,
    createElement(RecommendationQuickControls),
    createElement(CloudTimeline),
    createElement("button", { onClick: () => setSettingsOpen(true) }, "open settings"),
    settingsOpen && createElement<{ docked?: boolean }>(ObservingMapControl, { docked: true }),
    createElement("output", { "data-testid": "selected-hour" }, state.cloudState.activeForecastTime),
  );
}

afterEach(() => { cleanup(); store.current = null; localStorage.clear(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function settle() { await act(async () => { await Promise.resolve(); }); }

function mockSnapshots() {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    return new Response(JSON.stringify({ model: "icon", focusTime: url.searchParams.get("time"), date: url.searchParams.get("date"), days: 1, generatedAt: "2026-10-05T04:00:00Z", source: "fixture", stale: false, sites: {}, focusScores: {} }));
  }));
}

describe("shared forecast selection boundary", () => {
  it("does not offer a previous-night 00:00 tick in the current 12:00 forward window", async () => {
    const { container } = render(createElement(Harness));
    await settle();
    const ticks = [...container.querySelectorAll<HTMLButtonElement>(".cloud-tick")];
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks[0].title).toBe("10/5 12:00");
    expect(ticks.at(-1)?.title).toBe("10/8 12:00");
    expect(ticks.some(tick => tick.title === "10/5 00:00")).toBe(false);
  });

  it("keeps the first and last rendered tick selected after both components' effects settle", async () => {
    const { container } = render(createElement(Harness));
    await settle();
    for (const position of [0, -1]) {
      const ticks = [...container.querySelectorAll<HTMLButtonElement>(".cloud-tick")];
      const tick = ticks.at(position)!;
      fireEvent.click(tick);
      await settle();
      await waitFor(() => expect(tick.getAttribute("aria-pressed")).toBe("true"));
      expect(container.querySelector(".cloud-timeline")?.getAttribute("data-active-time")).toBe(screen.getByTestId("selected-hour").textContent);
      expect(container.querySelector<HTMLButtonElement>(".cloud-tick")?.title).toBe("10/5 12:00");
    }
  });

  it("retains both forward-window endpoints when they are not six-hour daytime probes", async () => {
    const { container } = render(createElement(Harness, { start: "2026-10-05T13:00" }));
    await settle();
    const ticks = [...container.querySelectorAll<HTMLButtonElement>(".cloud-tick")];
    expect(ticks[0].title).toBe("10/5 13:00");
    expect(ticks.at(-1)?.title).toBe("10/8 13:00");
  });

  it.each(["UTC", "America/Los_Angeles", "Asia/Shanghai"])("preserves cross-midnight provider labels in %s", async timezone => {
    vi.stubEnv("TZ", timezone);
    const { container } = render(createElement(Harness, { start: "2026-10-05T23:00" }));
    await settle();
    const midnight = container.querySelector<HTMLButtonElement>('.cloud-tick[title="10/6 00:00"]')!;
    expect(midnight).not.toBeNull();
    fireEvent.click(midnight);
    await settle();
    expect(midnight.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-06T00:00");
  });

  it("does not invent a selectable rail hour when that source hour is missing", async () => {
    const { container } = render(createElement(Harness, { omit: "2026-10-05T20:00" }));
    await settle();
    expect(container.querySelector('.cloud-tick[title="10/5 20:00"]')).toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "观星评分时间滑窗" }), { target: { value: "8" } });
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-05T20:00");
    expect(container.querySelector(".cloud-timeline")?.getAttribute("data-active-time")).toBe("2026-10-05T20:00");
    expect(screen.getByTestId("hourly-data-validity").textContent).toContain("当前时次没有完整天气字段");
  });

  it("retains an explicitly selected historical observation night without pretending it is inside the forward rail", async () => {
    const { container } = render(createElement(Harness, { night: "2026-10-03", sourceStart: "2026-10-03T00:00" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "展开逐小时预报" }));
    const matrix = container.querySelector(".hourly-matrix")!;
    const midnight = [...matrix.querySelectorAll<HTMLButtonElement>("thead button")].find(button => button.textContent?.startsWith("00:00"))!;
    expect(midnight).not.toBeUndefined();
    fireEvent.click(midnight);
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-04T00:00");
    expect(container.querySelector(".cloud-timeline")?.getAttribute("data-active-time")).toBe("2026-10-04T00:00");
    expect(container.querySelector(".cloud-timeline-current")?.textContent).toContain("00:00（次日）");
    const slider = screen.getByRole("slider", { name: "观星评分时间滑窗" }) as HTMLInputElement;
    expect(slider.value).toBe("0");
    expect(slider.getAttribute("aria-valuetext")).toContain("12:00");
    expect(container.querySelector(".recommendation-quick-slider strong")?.textContent).toContain("00:00（次日）");
    expect(screen.getByText("当前选择来自观测夜，拖动滑窗切回未来72小时")).toBeDefined();
    fireEvent.change(slider, { target: { value: "1" } });
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-05T13:00");
    expect(slider.hasAttribute("aria-describedby")).toBe(false);
  });

  it("preserves a selected future observation night beyond the compact 72-hour window", async () => {
    const { container } = render(createElement(Harness, { night: "2026-10-08" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "展开逐小时预报" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 00:00（次日）" }));
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-09T00:00");
    expect(container.querySelector(".cloud-timeline")?.getAttribute("data-active-time")).toBe("2026-10-09T00:00");
    expect(container.querySelector('.cloud-tick[title="10/9 00:00"]')).toBeNull();
    expect(container.querySelector(".cloud-timeline-current")?.textContent).toContain("10月8日");
  });

  it("keeps an explicit matrix selection in the future night displayed after a rail selection", async () => {
    const { container } = render(createElement(Harness, { start: "2026-10-05T23:00" }));
    await settle();
    fireEvent.click(container.querySelector<HTMLButtonElement>('.cloud-tick[title="10/8 23:00"]')!);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "展开逐小时预报" }));
    expect(container.querySelector(".hourly-matrix")?.getAttribute("aria-label")).toContain("2026-10-08");
    fireEvent.click(screen.getByRole("button", { name: "选择 05:00（次日）" }));
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-09T05:00");
    expect(container.querySelector(".cloud-timeline")?.getAttribute("data-active-time")).toBe("2026-10-09T05:00");
    expect(screen.getByRole("button", { name: "选择 05:00（次日）" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("does not borrow the 20:00 cloud value when the selected 13:00 source hour is missing", async () => {
    const { container } = render(createElement(Harness, { omit: "2026-10-05T13:00" }));
    await settle();
    fireEvent.change(screen.getByRole("slider", { name: "观星评分时间滑窗" }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "展开逐小时预报" }));
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-05T13:00");
    const cloud = [...container.querySelectorAll(".cloud-summary-card > span")].find(element => element.querySelector("b")?.textContent === "总云量");
    expect(cloud?.textContent).toBe("总云量—");
    expect(screen.getByTestId("hourly-data-validity").textContent).toContain("当前时次没有完整天气字段");
  });

  it("keeps the shared first tick after settings lazily mount at a later selected hour", async () => {
    mockSnapshots();
    const { container } = render(createElement(Harness));
    await settle();
    fireEvent.click(container.querySelector<HTMLButtonElement>('.cloud-tick[title="10/6 12:00"]')!);
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-06T12:00");
    fireEvent.click(screen.getByRole("button", { name: "open settings" }));
    await settle();
    fireEvent.click(container.querySelector<HTMLButtonElement>('.cloud-tick[title="10/5 12:00"]')!);
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-05T12:00");
    expect(container.querySelector(".observing-map-control")?.getAttribute("data-score-time")).toBe("2026-10-05T12:00");
  });

  it("keeps settings provenance on a selected historical matrix hour while its thumb stays in the forward window", async () => {
    mockSnapshots();
    const { container } = render(createElement(Harness, { night: "2026-10-03", sourceStart: "2026-10-03T00:00" }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: "open settings" }));
    fireEvent.click(screen.getByRole("button", { name: "展开逐小时预报" }));
    fireEvent.click(screen.getByRole("button", { name: "选择 00:00（次日）" }));
    await settle();
    expect(screen.getByTestId("selected-hour").textContent).toBe("2026-10-04T00:00");
    expect(container.querySelector(".observing-map-control")?.getAttribute("data-score-time")).toBe("2026-10-04T00:00");
    expect(screen.getByTestId("observing-score-provenance").textContent).toContain("2026-10-04T00:00");
    const slider = container.querySelector<HTMLInputElement>('.observing-score-window input[type="range"]')!;
    expect(slider.value).toBe("0");
    expect(slider.getAttribute("aria-valuetext")).toContain("12:00");
  });

  it.each([false, true])("corrects the initial shared clock without moving later selections (preselected=%s)", async preselected => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-05T05:30:00Z"));
    const actual = await vi.importActual<typeof import("@/lib/store")>("@/lib/store");
    function ClockProbe() {
      const { state, setCloud, selectNight } = actual.useStore();
      useLayoutEffect(() => {
        if (preselected) { selectNight("2026-10-03"); setCloud({ activeForecastTime: "2026-10-04T00:00" }); }
      }, [selectNight, setCloud]);
      return createElement(Fragment, null,
        createElement("output", { "data-testid": "clock" }, JSON.stringify({ start: state.forecastWindowStart, active: state.cloudState.activeForecastTime, night: state.selectedNight })),
        createElement("button", { onClick: () => setCloud({ activeForecastTime: "2026-10-06T00:00" }) }, "select another hour"));
    }
    render(createElement(actual.StoreProvider, { initialNow: "2026-10-05T04:00:00Z", children: createElement(ClockProbe) }));
    await settle();
    expect(JSON.parse(screen.getByTestId("clock").textContent!)).toEqual({ start: "2026-10-05T13:00", active: preselected ? "2026-10-04T00:00" : "2026-10-05T13:00", night: preselected ? "2026-10-03" : "2026-10-05" });
    fireEvent.click(screen.getByRole("button", { name: "select another hour" }));
    await settle();
    expect(JSON.parse(screen.getByTestId("clock").textContent!).start).toBe("2026-10-05T13:00");
  });
});
