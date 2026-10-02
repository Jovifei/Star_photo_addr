import { afterEach, describe, expect, it, vi } from "vitest";

const POINT = { latitude: 30.182, longitude: 108.882 };

function payload(model = "icon", sourceFetchedAt = new Date().toISOString()) {
  const fetchedAt = new Date().toISOString();
  const metadata = { source: "Open-Meteo", model, fetchedAt, sourceFetchedAt, stale: false, units: {} };
  return {
    metadata,
    locations: [{
      locationId: "loc-0",
      modelLatitude: POINT.latitude,
      modelLongitude: POINT.longitude,
      modelElevation: 1402,
      timezone: "Asia/Shanghai",
      utcOffsetSeconds: 28_800,
      fetchedAt,
      metadata,
      hourly: [{ time: "2026-09-13T21:00" }],
    }],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("shared forecast client", () => {
  it("honors a daily provider cooldown across coordinates and manual refresh", async () => {
    vi.resetModules();
    let now = Date.now();
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = vi.fn(async (url: string) => url.includes("cache_only=1") ? Response.json(payload()) : Response.json({ error: "daily quota" }, {
      status: 429, headers: { "Retry-After": "3600" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { requestForecastResponse } = await import("@/lib/forecastClient");
    await expect(requestForecastResponse([POINT], "icon")).rejects.toThrow(/daily quota.*3600 秒后重试/);
    now += 3 * 60_000;
    await expect(requestForecastResponse([POINT], "icon", 8, true)).resolves.toMatchObject({ stale: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]![0]).toContain("cache_only=1");
    now += 3600_000;
    await expect(requestForecastResponse([POINT], "icon")).rejects.toThrow(/daily quota.*3600 秒后重试/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("coalesces identical store/grid requests and preserves metadata", async () => {
    vi.resetModules();
    const fetchMock = vi.fn(async () => Response.json(payload()));
    vi.stubGlobal("fetch", fetchMock);
    const { requestForecastResponse } = await import("@/lib/forecastClient");
    const [first, second] = await Promise.all([
      requestForecastResponse([POINT], "icon", 14),
      requestForecastResponse([POINT], "icon", 8),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.data.locations[0]?.metadata?.model).toBe("icon");
    expect(first.data.locations[0]?.metadata?.sourceFetchedAt).toBeTruthy();
    expect(second.data.locations[0]?.metadata?.providerRunAt).toBeNull();
  });

  it("bounds different keys and marks an old source or stale header as unusable", async () => {
    vi.resetModules();
    let active = 0;
    let maximum = 0;
    const old = new Date(Date.now() - 11 * 60_000).toISOString();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      const parsed = new URL(url, "http://localhost");
      const latitude = Number(parsed.searchParams.get("latitude"));
      const body = payload("icon", old);
      body.locations[0]!.modelLatitude = latitude;
      return Response.json(body, { headers: { "X-Data-Stale": "true" } });
    }));
    const { requestForecastResponse } = await import("@/lib/forecastClient");
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      requestForecastResponse([{ latitude: 30 + index / 100, longitude: 108.8 }], "icon", 14),
    ));
    expect(maximum).toBeLessThanOrEqual(4);
    expect(results.every((result) => result.stale && result.data.locations[0]?.metadata?.stale)).toBe(true);
  });
});
