import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fetchPressureForecast: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.resetModules(); fetchPressureForecast = vi.fn(); });
afterEach(() => { vi.doUnmock("@/lib/pressure"); vi.restoreAllMocks(); });
async function route() {
  vi.doMock("@/lib/pressure", () => ({ fetchPressureForecast }));
  const { GET } = await import("@/app/api/pressure-forecast/route");
  const { OpenMeteoRateLimitError, noteOpenMeteoRateLimit } = await import("@/lib/forecast");
  return { GET, OpenMeteoRateLimitError, noteOpenMeteoRateLimit };
}
const request = (query = "") => new NextRequest(`http://localhost/api/pressure-forecast?latitude=30&longitude=120&model=icon${query}`);
describe("pressure provider cooldown", () => {
  it("cache-only miss and refresh=1 never contact the provider", async () => {
    const { GET } = await route();
    const response = await GET(request("&cache_only=1&refresh=1"));
    expect(response.status).toBe(503);
    expect(response.headers.get("x-pressure-cache")).toBe("cache-only-miss");
    expect(fetchPressureForecast).not.toHaveBeenCalled();
  });
  it("cache-only preserves original acquisition and marks old data stale", async () => {
    vi.useFakeTimers();
    try {
      const { GET } = await route();
      const fetchedAt = new Date().toISOString();
      fetchPressureForecast.mockResolvedValue({ model: "icon", hourly: [], fetchedAt, stale: false });
      await GET(request());
      vi.advanceTimersByTime(11 * 60_000);
      const response = await GET(request("&cache_only=1&refresh=1"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ fetchedAt, stale: true });
      expect(fetchPressureForecast).toHaveBeenCalledTimes(1);
      expect(response.headers.get("cache-control")).toBe("no-store");
    } finally { vi.useRealTimers(); }
  });
  it("returns429 with provider retry-after when no snapshot exists", async () => {
    const { GET, OpenMeteoRateLimitError } = await route();
    fetchPressureForecast.mockRejectedValue(new OpenMeteoRateLimitError(120_000));
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("does not shorten a provider daily cooldown on repeated force refresh", async () => {
    const { GET, OpenMeteoRateLimitError, noteOpenMeteoRateLimit } = await route();
    noteOpenMeteoRateLimit("3600", "Daily API request limit exceeded");
    fetchPressureForecast.mockRejectedValue(
      new OpenMeteoRateLimitError(3_600_000, true),
    );

    const first = await GET(request("&refresh=1"));
    expect(first.status).toBe(429);
    expect(Number(first.headers.get("retry-after"))).toBeGreaterThan(3_500);
    expect(first.headers.get("x-weather-limit")).toBe("daily");

    const suppressed = await GET(request("&refresh=1"));
    expect(suppressed.status).toBe(429);
    expect(Number(suppressed.headers.get("retry-after"))).toBeGreaterThan(3_500);
    expect(suppressed.headers.get("x-weather-limit")).toBe("daily");
    expect(fetchPressureForecast).toHaveBeenCalledTimes(1);
  });

  it("retains a cached snapshot as stale with provider retry-after", async () => {
    const { GET, OpenMeteoRateLimitError } = await route();
    fetchPressureForecast.mockResolvedValueOnce({ model: "icon", hourly: [], fetchedAt: "2026-10-02T00:00:00Z" });
    expect((await GET(request())).status).toBe(200);
    fetchPressureForecast.mockRejectedValueOnce(new OpenMeteoRateLimitError(120_000));
    const response = await GET(request("&refresh=1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("retry-after")).toBe("120");
    expect((await response.json()).stale).toBe(true);
  });
});
