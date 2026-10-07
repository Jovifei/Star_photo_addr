// @vitest-environment jsdom
import { createElement, Fragment } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationForecast } from "@/lib/types";
const { requestForecastResponse } = vi.hoisted(() => ({ requestForecastResponse: vi.fn() }));
vi.mock("@/lib/forecastClient", async (original) => ({ ...await original<object>(), requestForecastResponse }));
import { StoreProvider, useStore } from "@/lib/store";
import { SELECTED_LOCATION_STORAGE_KEY } from "@/lib/constants";
function Probe() { const { state } = useStore(); return createElement("div", { "data-testid": "state" }, `${state.loading}|${state.forecast?.locationId ?? "none"}`); }

const LA_LOCATION = { id: "la", name: "Los Angeles", latitude: 34.0522, longitude: -118.2437, elevation: null, source: "搜索" as const };
function laForecast(): LocationForecast {
  const fetchedAt = new Date().toISOString();
  return {
    locationId: LA_LOCATION.id,
    modelLatitude: LA_LOCATION.latitude,
    modelLongitude: LA_LOCATION.longitude,
    modelElevation: 90,
    timezone: "America/Los_Angeles",
    utcOffsetSeconds: -25_200,
    fetchedAt,
    metadata: { source: "Open-Meteo", model: "icon", fetchedAt, sourceFetchedAt: fetchedAt, stale: false, units: {} },
    hourly: [{ time: "2026-10-06T22:00" }],
  };
}
function ClockProbe() {
  const { state, selectLocation, selectNight, setCloud } = useStore();
  const extended = state as typeof state & {
    catalogSelectedNight?: string;
    catalogForecastTime?: string | null;
  };
  const clock = {
    pointNight: state.selectedNight,
    pointTime: state.cloudState.activeForecastTime,
    pointWindow: state.forecastWindowStart,
    catalogNight: extended.catalogSelectedNight ?? null,
    catalogTime: extended.catalogForecastTime ?? null,
    timezone: state.selectedLocation?.timezone ?? null,
    forecastId: state.forecast?.locationId ?? null,
  };
  return createElement(Fragment, null,
    createElement("output", { "data-testid": "clock" }, JSON.stringify(clock)),
    createElement("button", { onClick: () => void selectLocation(LA_LOCATION, "icon") }, "select la"),
    createElement("button", { onClick: () => {
      selectNight("2026-10-08");
      setCloud({ activeForecastTime: "2026-10-08T20:00" });
    } }, "pin explicit"),
  );
}
afterEach(() => { cleanup(); localStorage.clear(); requestForecastResponse.mockReset(); vi.useRealTimers(); });
describe("persisted selected weather hydration", () => {
  it("finishes after its loading dispatch rerenders the provider", async () => {
    localStorage.setItem(SELECTED_LOCATION_STORAGE_KEY, JSON.stringify({ id: "persisted", name: "保留地点", latitude: 30, longitude: 120, elevation: null }));
    let resolve!: (value: unknown) => void;
    requestForecastResponse.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(createElement(StoreProvider, { initialNow: new Date().toISOString(), children: createElement(Probe) }));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("true|none"));
    expect(requestForecastResponse).toHaveBeenCalledTimes(1);
    const fetchedAt = new Date().toISOString();
    const forecast = { locationId: "persisted", fetchedAt, metadata: { model: "icon", fetchedAt, sourceFetchedAt: fetchedAt, stale: false }, hourly: [] } as unknown as LocationForecast;
    await act(async () => { resolve({ data: { locations: [forecast] }, stale: false }); });
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("false|persisted"));
    expect(requestForecastResponse).toHaveBeenCalledTimes(1);
  });
});


describe("selected point timezone clock", () => {
  const NOW = "2026-10-07T05:58:59.788Z";

  it("uses the selected forecast timezone while leaving the China catalog clock unchanged", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    const forecast = laForecast();
    requestForecastResponse.mockResolvedValue({ data: { locations: [forecast], metadata: forecast.metadata }, stale: false });
    render(createElement(StoreProvider, { initialNow: NOW, children: createElement(ClockProbe) }));
    fireEvent.click(screen.getByRole("button", { name: "select la" }));
    await waitFor(() => {
      const clock = JSON.parse(screen.getByTestId("clock").textContent!);
      expect(clock).toMatchObject({
        pointNight: "2026-10-06",
        pointTime: "2026-10-06T22:00",
        pointWindow: "2026-10-06T22:00",
        catalogNight: "2026-10-07",
        catalogTime: "2026-10-07T13:00",
        timezone: "America/Los_Angeles",
        forecastId: "la",
      });
    });
  });

  it("does not overwrite an explicit point night/hour selected while forecast hydration is in flight", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(NOW));
    let resolve!: (value: unknown) => void;
    requestForecastResponse.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(createElement(StoreProvider, { initialNow: NOW, children: createElement(ClockProbe) }));
    fireEvent.click(screen.getByRole("button", { name: "select la" }));
    fireEvent.click(screen.getByRole("button", { name: "pin explicit" }));
    const forecast = laForecast();
    await act(async () => { resolve({ data: { locations: [forecast], metadata: forecast.metadata }, stale: false }); });
    await waitFor(() => {
      const clock = JSON.parse(screen.getByTestId("clock").textContent!);
      expect(clock).toMatchObject({
        pointNight: "2026-10-08",
        pointTime: "2026-10-08T20:00",
        pointWindow: "2026-10-07T13:00",
        catalogNight: "2026-10-07",
        catalogTime: "2026-10-07T13:00",
        timezone: "America/Los_Angeles",
        forecastId: "la",
      });
    });
  });
});
