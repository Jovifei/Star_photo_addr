import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ForecastModel, ForecastResponse } from "@/lib/types";

const ENV_KEYS = [
  "FORECAST_CACHE_TTL_MS",
  "FORECAST_STALE_TTL_MS",
  "FORECAST_FORCE_REFRESH_COOLDOWN_MS",
  "OBSERVING_SNAPSHOT_DIR",
  "FORECAST_ENABLE_DISK_CACHE",
] as const;

let fetchForecastByCoords: ReturnType<typeof vi.fn>;

function metadata(model: ForecastModel) {
  return {
    source: "Open-Meteo" as const,
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
  vi.doMock("@/lib/forecast", async () => ({
    ...await vi.importActual<typeof import("@/lib/forecast")>("@/lib/forecast"),
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
  it("reads server cache during provider cooldown without calling upstream on a miss", async () => {
    fetchForecastByCoords.mockResolvedValue(payload("icon"));
    const { GET } = await loadRoute();
    const query = "latitude=30.2741&longitude=120.1551&model=icon&days=2";
    expect((await GET(request(`${query}&cache_only=1`))).status).toBe(429);
    expect(fetchForecastByCoords).not.toHaveBeenCalled();
    expect((await GET(request(query))).status).toBe(200);
    const cached = await GET(request(`${query}&cache_only=1&refresh=1`));
    expect(cached.status).toBe(200);
    expect(cached.headers.get("X-Forecast-Cache")).toBe("cache-only-memory");
    expect(fetchForecastByCoords).toHaveBeenCalledTimes(1);
  });
  it.each([1, 64])("keeps %i fresh locations persistent for cache-only reads after route restart", async (count) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "forecast-route-cache-"));
    process.env.OBSERVING_SNAPSHOT_DIR = directory;
    process.env.FORECAST_ENABLE_DISK_CACHE = "1";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T00:05:00Z"));
    try {
      const data = payload("icon");
      data.locations = Array.from({ length: count }, (_, index) => ({ ...data.locations[0], locationId: `loc-${index}` }));
      fetchForecastByCoords.mockResolvedValue(data);
      const firstRoute = await loadRoute();
      const latitudes = Array.from({ length: count }, (_, index) => 30.2741 + index / 1000).join(",");
      const longitudes = Array.from({ length: count }, (_, index) => 120.1551 + index / 1000).join(",");
      const query = `latitude=${latitudes}&longitude=${longitudes}&model=icon&days=2`;
      const first = await firstRoute.GET(request(query));
      expect(first.status).toBe(200);
      expect(first.headers.get("X-Data-Stale")).toBe("false");
      expect(fetchForecastByCoords).toHaveBeenCalledTimes(1);

      const files = fs.readdirSync(path.join(directory, "forecast-cache"));
      expect(files).toHaveLength(1);
      expect(files[0].length).toBeLessThanOrEqual(80);
      vi.resetModules();
      fetchForecastByCoords = vi.fn();
      const restartedRoute = await loadRoute();
      const cached = await restartedRoute.GET(request(`${query}&cache_only=1`));
      const body = (await cached.json()) as ForecastResponse;

      expect(cached.status).toBe(200);
      expect(cached.headers.get("X-Forecast-Cache")).toBe("cache-only-disk");
      expect(cached.headers.get("X-Data-Stale")).toBe("false");
      expect(body.metadata?.stale).toBe(false);
      expect(fetchForecastByCoords).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("preserves daily quota status and Retry-After for the browser", async () => {
    const { GET } = await loadRoute();
    const { OpenMeteoRateLimitError } = await import("@/lib/forecast");
    fetchForecastByCoords.mockRejectedValue(new OpenMeteoRateLimitError(86_400_000, true));
    const response = await GET(new NextRequest("http://localhost/api/forecast?latitude=30&longitude=120&model=icon"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("86400");
    expect(response.headers.get("X-Weather-Limit")).toBe("daily");
  });
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
