import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let fetchPressureForecast: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  fetchPressureForecast = vi.fn();
});

afterEach(() => {
  vi.doUnmock("@/lib/pressure");
  vi.restoreAllMocks();
});

it("returns provider 429 and Retry-After instead of converting it to 502", async () => {
  vi.doMock("@/lib/pressure", async () => {
    const { OpenMeteoRateLimitError } = await import("@/lib/openMeteoRateLimit");
    fetchPressureForecast.mockRejectedValue(new OpenMeteoRateLimitError(65_000));
    return { fetchPressureForecast };
  });
  const { GET } = await import("@/app/api/pressure-forecast/route");
  const response = await GET(new NextRequest("http://localhost/api/pressure-forecast?latitude=30&longitude=120&model=gfs"));

  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("65");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
