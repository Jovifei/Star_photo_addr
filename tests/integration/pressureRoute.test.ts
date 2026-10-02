import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let fetchPressureForecast: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.resetModules(); fetchPressureForecast = vi.fn(); });
afterEach(() => { vi.doUnmock("@/lib/pressure"); vi.restoreAllMocks(); });
async function route() {
  vi.doMock("@/lib/pressure", () => ({ fetchPressureForecast }));
  const { GET } = await import("@/app/api/pressure-forecast/route");
  const { OpenMeteoRateLimitError } = await import("@/lib/forecast");
  return { GET, OpenMeteoRateLimitError };
}
const request = (query = "") => new NextRequest(`http://localhost/api/pressure-forecast?latitude=30&longitude=120&model=icon${query}`);
describe("pressure provider cooldown", () => {
  it("returns429 with provider retry-after when no snapshot exists", async () => {
    const { GET, OpenMeteoRateLimitError } = await route();
    fetchPressureForecast.mockRejectedValue(new OpenMeteoRateLimitError(120_000));
    const response = await GET(request());
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(response.headers.get("cache-control")).toContain("no-store");
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
