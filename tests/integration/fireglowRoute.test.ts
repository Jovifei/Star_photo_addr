import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let fetchFinderWeatherRange: ReturnType<typeof vi.fn>;
let buildFireGlowSnapshot: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  fetchFinderWeatherRange = vi.fn().mockResolvedValue({
    "2026-09-15": { data: {} },
  });
  buildFireGlowSnapshot = vi.fn((date: string, model: string) => ({
    date,
    model,
    generatedAt: new Date().toISOString(),
    source: "test",
    stale: false,
    sites: {},
  }));
});

afterEach(() => {
  vi.doUnmock("@/lib/stargazingFinderWeather");
  vi.doUnmock("@/lib/fireglow");
  vi.restoreAllMocks();
});

it("defaults the dedicated fireglow snapshot to GFS", async () => {
  vi.doMock("@/lib/stargazingFinderWeather", () => ({
    fetchFinderWeatherRange,
    isFinderDateAllowed: () => true,
  }));
  vi.doMock("@/lib/fireglow", () => ({ buildFireGlowSnapshot }));
  const { GET } = await import("@/app/api/fireglow/snapshot/route");
  const response = await GET(new NextRequest("http://localhost/api/fireglow/snapshot?date=2026-09-15"));

  expect(response.status).toBe(200);
  expect(fetchFinderWeatherRange).toHaveBeenCalledWith(
    ["2026-09-15"],
    expect.anything(),
    false,
    "gfs",
  );
  expect(buildFireGlowSnapshot).toHaveBeenCalledWith("2026-09-15", "gfs", { "2026-09-15": {} });
});

it("returns provider 429 and Retry-After from the fireglow route", async () => {
  const { OpenMeteoRateLimitError } = await import("@/lib/openMeteoRateLimit");
  vi.doMock("@/lib/stargazingFinderWeather", () => ({
    fetchFinderWeatherRange: vi.fn().mockRejectedValue(new OpenMeteoRateLimitError(65_000)),
    isFinderDateAllowed: () => true,
  }));
  vi.doMock("@/lib/fireglow", () => ({ buildFireGlowSnapshot }));
  const { GET } = await import("@/app/api/fireglow/snapshot/route");
  const response = await GET(new NextRequest("http://localhost/api/fireglow/snapshot?date=2026-09-15"));

  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("65");
});
