import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DataSourceHealthResponse } from "@/lib/dataSourceStatus";

let getDataSourceHealth: ReturnType<typeof vi.fn>;

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/data-status${query}`);
}

function response(
  overrides: Partial<DataSourceHealthResponse> = {},
): DataSourceHealthResponse {
  return {
    status: "ok",
    checkedAt: "2026-08-20T00:00:00.000Z",
    cached: false,
    sources: {},
    ...overrides,
  };
}

async function loadRoute() {
  vi.doMock("@/lib/dataSourceHealth", () => ({ getDataSourceHealth }));
  return import("@/app/api/data-status/route");
}

beforeEach(() => {
  vi.resetModules();
  getDataSourceHealth = vi.fn();
});

afterEach(() => {
  vi.doUnmock("@/lib/dataSourceHealth");
  vi.restoreAllMocks();
});

describe("GET /api/data-status", () => {
  it("reports a normal cached diagnostic response", async () => {
    getDataSourceHealth.mockResolvedValue(response({ cached: true }));
    const { GET } = await loadRoute();
    const result = await GET(request());

    expect(result.status).toBe(200);
    expect(result.headers.get("x-data-source-cache")).toBe("memory");
    expect(result.headers.get("cache-control")).toContain("s-maxage=300");
    expect(getDataSourceHealth).toHaveBeenCalledWith(false);
  });

  it("marks a coalesced provider probe", async () => {
    getDataSourceHealth.mockResolvedValue(
      response({ coalesced: true, cached: false }),
    );
    const { GET } = await loadRoute();
    const result = await GET(request());

    expect(result.headers.get("x-data-source-cache")).toBe("coalesced");
  });

  it("exposes force-refresh cooldown metadata without browser caching", async () => {
    const nextRefreshAt = "2026-08-20T00:01:00.000Z";
    getDataSourceHealth.mockResolvedValue(
      response({ refreshSuppressed: true, nextRefreshAt }),
    );
    const { GET } = await loadRoute();
    const result = await GET(request("?refresh=1"));

    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("x-data-source-cache")).toBe(
      "refresh-cooldown",
    );
    expect(result.headers.get("x-refresh-suppressed")).toBe("true");
    expect(result.headers.get("x-next-refresh-at")).toBe(nextRefreshAt);
    expect(getDataSourceHealth).toHaveBeenCalledWith(true);
  });
});
