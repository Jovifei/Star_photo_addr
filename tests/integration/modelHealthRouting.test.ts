import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
let probe: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules();
  probe = vi.fn().mockResolvedValue({ status: "degraded", checkedAt: "2026-09-15T00:00:00Z", cached: false, sources: {} });
  vi.doMock("@/lib/dataSourceHealth", () => ({ getDataSourceHealth: probe }));
});
afterEach(() => { vi.doUnmock("@/lib/dataSourceHealth"); vi.restoreAllMocks(); });
it("uses GFS by default and does not edge-cache a degraded result", async () => {
  const { GET } = await import("@/app/api/data-status/route");
  const response = await GET(new NextRequest("http://localhost/api/data-status"));
  expect(probe).toHaveBeenCalledWith(false, "gfs");
  expect(response.headers.get("x-weather-probe-model")).toBe("gfs");
  expect(response.headers.get("cache-control")).toContain("no-store");
});
it("preserves an explicit model in the diagnostic request", async () => {
  const { GET } = await import("@/app/api/data-status/route");
  const response = await GET(new NextRequest("http://localhost/api/data-status?model=icon&refresh=1"));
  expect(probe).toHaveBeenCalledWith(true, "icon");
  expect(response.headers.get("x-weather-probe-model")).toBe("icon");
});
it("keeps the data-sources health alias model-qualified", async () => {
  const { GET } = await import("@/app/api/data-sources/health/route");
  const response = await GET(new NextRequest("http://localhost/api/data-sources/health?model=aifs"));
  expect(probe).toHaveBeenCalledWith(false, "aifs");
  expect(response.headers.get("x-weather-probe-model")).toBe("aifs");
});
it("rejects an invalid model without contacting providers", async () => {
  const { GET } = await import("@/app/api/data-status/route");
  const response = await GET(new NextRequest("http://localhost/api/data-status?model=not-a-model"));
  expect(response.status).toBe(400);
  expect(probe).not.toHaveBeenCalled();
});
