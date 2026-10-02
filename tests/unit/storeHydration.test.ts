// @vitest-environment jsdom
import { createElement } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocationForecast } from "@/lib/types";
const { requestForecastResponse } = vi.hoisted(() => ({ requestForecastResponse: vi.fn() }));
vi.mock("@/lib/forecastClient", async (original) => ({ ...await original<object>(), requestForecastResponse }));
import { StoreProvider, useStore } from "@/lib/store";
import { SELECTED_LOCATION_STORAGE_KEY } from "@/lib/constants";
function Probe() { const { state } = useStore(); return createElement("div", { "data-testid": "state" }, `${state.loading}|${state.forecast?.locationId ?? "none"}`); }
afterEach(() => { cleanup(); localStorage.clear(); requestForecastResponse.mockReset(); });
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
