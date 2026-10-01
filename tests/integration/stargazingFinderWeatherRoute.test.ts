import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FinderWeatherResponse } from "@/lib/stargazingFinderTypes";

function request(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/stargazing-finder/weather?${query}`);
}

function noHourly(date = "2026-10-01"): FinderWeatherResponse {
  return {
    date,
    fetchedAt: "2026-10-01T00:00:00.000Z",
    model: "icon",
    providerRunAt: null,
    source: "Open-Meteo Forecast API · icon",
    stale: true,
    data: {
      site: {
        hourly: null,
        status: "error",
        error: "天气上游每日额度已用尽",
      },
    },
  };
}

function staleHourly(date = "2026-10-01"): FinderWeatherResponse {
  return {
    date,
    fetchedAt: "2026-10-01T01:00:00.000Z",
    sourceFetchedAt: "2026-10-01T00:00:00.000Z",
    model: "icon",
    providerRunAt: null,
    source: "Open-Meteo Forecast API · icon",
    stale: true,
    data: {
      site: {
        hourly: {
          time: [`${date}T20:00`],
          relative_humidity_2m: [60],
          dew_point_2m: [8],
          precipitation_probability: [0],
          weather_code: [0],
          cloud_cover: [10],
          cloud_cover_low: [0],
          cloud_cover_mid: [5],
          cloud_cover_high: [8],
          precipitation: [0],
          visibility: [20_000],
          wind_speed_10m: [1],
          wind_gusts_10m: [2],
          temperature_2m: [15],
        },
        status: "stale",
        fetchedAt: "2026-10-01T00:00:00.000Z",
        model: "icon",
      },
    },
  };
}

async function loadRoute(payload: FinderWeatherResponse) {
  vi.resetModules();
  const forecast = await import("@/lib/forecast");
  forecast.noteOpenMeteoRateLimit(
    "3600",
    "Daily API request limit exceeded",
  );
  const fetchFinderWeather = vi.fn().mockResolvedValue(payload);
  vi.doMock("@/lib/stargazingFinderWeather", () => ({
    fetchFinderWeather,
    isFinderDateAllowed: () => true,
  }));
  const route = await import("@/app/api/stargazing-finder/weather/route");
  return { GET: route.GET, fetchFinderWeather };
}

afterEach(() => {
  vi.doUnmock("@/lib/stargazingFinderWeather");
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("GET /api/stargazing-finder/weather provider cooldown", () => {
  it("returns the long provider 429 when no usable Finder weather exists", async () => {
    const { GET, fetchFinderWeather } = await loadRoute(noHourly());
    const query = "date=2026-10-01&model=icon&refresh=1";

    const first = await GET(request(query));
    expect(first.status).toBe(429);
    expect(Number(first.headers.get("Retry-After"))).toBeGreaterThan(3_500);
    expect(first.headers.get("X-Weather-Limit")).toBe("daily");
    expect(first.headers.get("X-Finder-Cache")).toBe("provider-cooldown");
    expect(fetchFinderWeather).toHaveBeenCalledTimes(1);

    const suppressed = await GET(request(query));
    expect(suppressed.status).toBe(429);
    expect(Number(suppressed.headers.get("Retry-After"))).toBeGreaterThan(3_500);
    expect(suppressed.headers.get("X-Weather-Limit")).toBe("daily");
    expect(fetchFinderWeather).toHaveBeenCalledTimes(1);
  });

  it("serves usable stale Finder weather with provider cooldown metadata", async () => {
    const { GET } = await loadRoute(staleHourly());
    const response = await GET(request("date=2026-10-01&model=icon"));

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Data-Stale")).toBe("true");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(3_500);
    expect(response.headers.get("X-Weather-Limit")).toBe("daily");
  });
});
