import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("planner Open-Meteo adapter", () => {
  it("resolves a superseded caller with the newest forecast", async () => {
    const pending = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url, options = {}) =>
        new Promise((resolve, reject) => {
          const signal = options.signal;
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("superseded", "AbortError")),
            { once: true },
          );
          pending.push({ url: String(url), resolve });
        }),
      ),
    );

    const { fetchSurfaceForecasts } = await import(
      "../../src/features/planner/lib/openMeteo.js"
    );
    const firstLocation = {
      id: "first",
      latitude: 30,
      longitude: 120,
    };
    const latestLocation = {
      id: "latest",
      latitude: 31,
      longitude: 121,
    };

    const first = fetchSurfaceForecasts(
      [firstLocation],
      7,
      undefined,
      "icon",
    );
    const latest = fetchSurfaceForecasts(
      [latestLocation],
      7,
      undefined,
      "gfs",
    );

    expect(pending).toHaveLength(2);
    expect(pending[0].url).toContain("model=icon");
    expect(pending[1].url).toContain("model=gfs");
    pending[1].resolve({
      ok: true,
      json: async () => ({
        locations: [
          {
            locationId: "loc-0",
            hourly: [],
            metadata: { model: "gfs" },
          },
        ],
      }),
    });

    await expect(latest).resolves.toMatchObject([
      { locationId: "latest", metadata: { model: "gfs" } },
    ]);
    await expect(first).resolves.toMatchObject([
      { locationId: "latest", metadata: { model: "gfs" } },
    ]);
  });
});
