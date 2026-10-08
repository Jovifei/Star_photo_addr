// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LocationDetailCharts from "@/components/LocationDetailCharts";
import type { HourEvaluation, Location } from "@/lib/types";
vi.mock("echarts-for-react", () => ({ default: ({ option }: { option: unknown }) => createElement("div", { "data-testid": "chart" }, JSON.stringify(option)) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const early = Date.parse("2026-11-01T08:00Z") / 1000;
const later = early + 3600;
const time = "2026-11-01T01:00";
const profile = (heightMsl: number) => [{ pressure: 900, heightMsl, cloudCover: 70, humidity: 80, temperature: 5 }];
const pressure = {
  model: "gfs", requestedLatitude: 34, requestedLongitude: -118, modelElevation: 100, stale: false, timeAxisVersion: "epoch-v1",
  hourly: [{ time, epochSeconds: early }, { time, epochSeconds: later }],
  profiles: { [time]: profile(1000) }, profilesByEpoch: { [early]: profile(1000), [later]: profile(2000) },
};
const location = { id: "la", name: "LA", latitude: 34, longitude: -118, elevation: 300 } as Location;
const hours = [{ time, epochSeconds: early, utcOffsetSeconds: -25200 }, { time, epochSeconds: later, utcOffsetSeconds: -28800 }] as HourEvaluation[];
const props = { evaluation: { hours }, location, nightKey: "2026-10-31", activeHour: time, activeEpoch: later, model: "gfs" };
it("selects the exact repeated-hour profile and hides it immediately on location change/failure", async () => {
  let rejectNext: (error: Error) => void = () => {};
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(pressure))).mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectNext = reject; })));
  const view = render(createElement(LocationDetailCharts, props));
  await screen.findAllByText(/2000/);
  expect(screen.getAllByTestId("chart").at(-1)?.textContent).toContain("2000");
  view.rerender(createElement(LocationDetailCharts, { ...props, location: { ...location, longitude: -117 } }));
  expect(screen.queryByText(/2000/)).toBeNull();
  await act(async () => { rejectNext(new Error("offline")); });
  await screen.findByText("垂直云层暂时不可用");
  expect(screen.queryByText(/2000/)).toBeNull();
});
it("ignores a late response from the previous model even when fetch ignores abort", async () => {
  let resolveOld: (response: Response) => void = () => {};
  vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(new Response(JSON.stringify({ ...pressure, model: "icon", profiles: { [time]: profile(3000) }, profilesByEpoch: { [later]: profile(3000) } }))));
  const view = render(createElement(LocationDetailCharts, props));
  view.rerender(createElement(LocationDetailCharts, { ...props, model: "icon" }));
  await screen.findAllByText(/3000/);
  await act(async () => { resolveOld(new Response(JSON.stringify(pressure))); });
  expect(screen.queryByText(/1000/)).toBeNull();
  expect(screen.getAllByTestId("chart").at(-1)?.textContent).toContain("3000");
});

it("clears a previously displayed ordinary profile when the new point fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(pressure))).mockRejectedValueOnce(new Error("offline")));
  const view = render(createElement(LocationDetailCharts, { ...props, activeEpoch: early }));
  await screen.findAllByText(/1000/);
  view.rerender(createElement(LocationDetailCharts, { ...props, activeEpoch: early, location: { ...location, longitude: -117 } }));
  await screen.findByText("垂直云层暂时不可用");
  expect(screen.queryByText(/1000/)).toBeNull();
});
it("rejects a successful response from contradictory coordinates or model", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...pressure, requestedLongitude: 102 }))));
  render(createElement(LocationDetailCharts, props));
  await screen.findByText("垂直云层暂时不可用");
  expect(screen.queryByText(/2000/)).toBeNull();
});
it("preserves raw partial profile but withholds cloud relation when fewer than six complete layers exist", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(pressure))));
  const view = render(createElement(LocationDetailCharts, props));
  await screen.findAllByText(/2000/);
  expect(view.container.querySelector(".cloud-layer-badge")).toBeNull();
});
it("a legacy wall-clock selection marks only the earlier repeated hour active", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(pressure))));
  const view = render(createElement(LocationDetailCharts, { ...props, activeEpoch: null, onSelectHour: vi.fn() }));
  await screen.findAllByText(/1000/);
  const selected = view.container.querySelectorAll(".detail-hour-chip--active");
  expect(selected).toHaveLength(1);
  expect(selected[0].getAttribute("aria-label")).toContain("UTC-7");
});
