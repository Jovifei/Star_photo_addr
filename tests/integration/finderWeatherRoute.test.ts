import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let fetchFinderWeather: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  fetchFinderWeather = vi.fn();
});

afterEach(() => {
  vi.doUnmock("@/lib/stargazingFinderWeather");
  vi.restoreAllMocks();
});

it("returns provider 429 and Retry-After from the Finder weather route", async () => {
  vi.doMock("@/lib/stargazingFinderWeather", async () => {
    const { OpenMeteoRateLimitError } = await import("@/lib/openMeteoRateLimit");
    fetchFinderWeather.mockRejectedValue(new OpenMeteoRateLimitError(65_000));
    return { fetchFinderWeather, isFinderDateAllowed: () => true };
  });
  const { GET } = await import("@/app/api/stargazing-finder/weather/route");
  const response = await GET(new NextRequest("http://localhost/api/stargazing-finder/weather?date=2026-09-15&model=gfs"));

  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("65");
  expect(response.headers.get("cache-control")).toBe("no-store");
});
