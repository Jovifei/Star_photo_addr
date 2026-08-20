import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ForecastModel, ForecastResponse } from "@/lib/types";

const ENV_KEYS = [
  "FORECAST_CACHE_TTL_MS",
  "FORECAST_STALE_TTL_MS",
  "FORECAST_FORCE_REFRESH_COOLDOWN_MS",
] as const;

let fetchForecastByCoords: ReturnType<typeof vi.fn>;

function metadata(model: ForecastModel) {
  return {
    source: "Integration Test",
    model,
    fetchedAt: "2026-08-20T00:00:00.000Z",
    stale: false,
    units: { cloudCover: "%", precipitation: "mm", windSpeed: "m/s" },
  };
}

function payload(model: ForecastModel = "gfs"): ForecastResponse {
  const meta = metadata(model);
  return {
    metadata: meta,
    locations: [
      {
        locationId: "loc-0",
        modelLatitude: 30.2741,
        modelLongitude: 120.1551,
        modelElevation: 20,
        timezone: "Asia/Shanghai",
        utcOffsetSeconds: 28_800,
        fetchedAt: meta.fetchedAt,
        metadata: meta,
        hourly: [
          {
            time: "2026-08-20T20:00",
            temperature: 20,
            humidity: 60,
            dewPoint: 12,
            precipitationProbability: 0,
            precipitation: 0,
            weatherCode: 0,
            cloudCover: 10,
            cloudLow: 5,
            cloudMid: 8,
            cloudHigh: 12,
            visibility: 25_000,
            windSpeed: 2,
            windGust: 4,
            windDirection: 180,
          },
        ],
      },
    ],
  };
}

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/forecast?${query}`);
}

function clampDays(days: number, model: ForecastModel): number {
  const maximum = model === "icon" ? 8 : model === "aifs" ? 15 : 16;
  return Math.min(maximum, Math.max(1, Math.floor(days)));
}

async function loadRoute() {
  vi.doMock("@/lib/forecast", () => ({
    clampForecastDays: clampDays,
    fetchForecastByCoords,
  }));
  return import("@/app/api/forecast/route");
}

beforeEach(() => {
  vi.resetModules();
  fetchForecastByCoords = vi.fn();
});

afterEach(() => {
  vi.doUnmock("@/lib/forecast");
  vi.restoreAllMocks();
  vi.useRealTimers();
  for (const key of ENV_KEYS) delete process.env[key];
});

describe("GET /api/forecast", () => {
  it.each([
    "latitude=&longitude=&model=gfs",
    "latitude=30.2,&longitude=120.1,121.2&model=gfs",
    "latitude=30.2,31.3&longitude=120.1&model=gfs",
    "latitude=91&longitude=120&model=gfs",
  ])("rejects invalid coordinate input: %s", async (query) => {
    const { GET } = await loadRoute();
    const response = await GET(request(query));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(fetchForecastByCoords).not.toHaveBeenCalled();
  });

  it("rejects an unsupported forecast model before upstream work", async () => {
    const { GET } = await loadRoute();
    const response = await GET(
      request("latitude=30.2741&longitude=120.1551&model=unknown"),
    );

    expect(response.status).toBe(400);
    expect(fetchForecastByCoords).not.toHaveBeenCalled();
  });

  it("accepts a real zero coordinate and clamps the model horizon", async () => {
    fetchForecastByCoords.mockResolvedValue(payload("icon"));
    const { GET } = await loadRoute();
    const response = await GET(
      request("latitude=0&longitude=0&days=30&model=icon"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-forecast-model")).toBe("icon");
    expect(response.headers.get("x-forecast-days")).toBe("8");
    expect(fetchForecastByCoords).toHaveBeenCalledWith(
      [0],
      [0],
      8,
      expect.anything(),
      "icon",
    );
  });

  it("coalesces two identical concurrent requests", async () => {
    let resolve: ((value: ForecastResponse) => void) | undefined;
    fetchForecastByCoords.mockImplementation(
      () =>
        new Promise<ForecastResponse>((done) => {
          resolve = done;
        }),
    );
    const { GET } = await loadRoute();
    const query = "latitude=30.2741&longitude=120.1551&days=1&model=gfs";

    const first = GET(request(query));
    const second = GET(request(query));
    await vi.waitFor(() =>
      expect(fetchForecastByCoords).toHaveBeenCalledTimes(1),
    );
    resolve?.(payload());

    const [firstResponse, secondResponse] = await Promise.all([first, second]);
    expect(
      [
        firstResponse.headers.get("x-forecast-cache"),
        secondResponse.headers.get("x-forecast-cache"),
      ].sort(),
    ).toEqual(["coalesced", "refresh"]);
  });

  it("blocks repeated cold-cache force refresh after an upstream failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchForecastByCoords.mockRejectedValueOnce(new Error("network down"));
    const { GET } = await loadRoute();
    const query =
      "latitude=30.2741&longitude=120.1551&days=1&model=gfs&refresh=1";

    const first = await GET(request(query));
    expect(first.status).toBe(502);

    fetchForecastByCoords.mockResolvedValue(payload());
    const second = await GET(request(query));
    expect(second.status).toBe(429);
    expect(second.headers.get("x-refresh-suppressed")).toBe("true");
    expect(Number(second.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchForecastByCoords).toHaveBeenCalledTimes(1);
  });

  it("returns explicitly stale cached data when a refresh fails", async () => {
    process.env.FORECAST_CACHE_TTL_MS = "30000";
    process.env.FORECAST_STALE_TTL_MS = "60000";
    process.env.FORECAST_FORCE_REFRESH_COOLDOWN_MS = "5000";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T00:00:00Z"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    fetchForecastByCoords.mockResolvedValueOnce(payload());
    const { GET } = await loadRoute();
    const normalQuery = "latitude=30.2741&longitude=120.1551&days=1&model=gfs";
    expect((await GET(request(normalQuery))).status).toBe(200);

    vi.advanceTimersByTime(31_000);
    fetchForecastByCoords.mockRejectedValueOnce(new Error("upstream unavailable"));
    const stale = await GET(request(`${normalQuery}&refresh=1`));
    const body = (await stale.json()) as ForecastResponse;

    expect(stale.status).toBe(200);
    expect(stale.headers.get("x-forecast-cache")).toBe("stale-memory");
    expect(stale.headers.get("x-data-stale")).toBe("true");
    expect(stale.headers.get("warning")).toContain("Response is stale");
    expect(body.metadata?.stale).toBe(true);
    expect(body.locations[0]?.metadata?.stale).toBe(true);
  });
});
