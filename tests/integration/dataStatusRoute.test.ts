import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DataSourceHealthResponse,
  DataSourceProbe,
} from "@/lib/dataSourceStatus";

let getDataSourceHealth: ReturnType<typeof vi.fn>;

function request(query = ""): NextRequest {
  return new NextRequest(`http://localhost/api/data-status${query}`);
}

function probe(id: DataSourceProbe["id"]): DataSourceProbe {
  return {
    id,
    label: id,
    status: "available",
    detail: "integration fixture",
    checkedAt: "2026-08-20T00:00:00.000Z",
  };
}

function response(
  overrides: Partial<DataSourceHealthResponse> = {},
): DataSourceHealthResponse {
  return {
    status: "ok",
    model: "best_match", cloudAvailable: true, scoringAvailable: true,
    missingCloudFields: [], missingScoringFields: [],
    checkedAt: "2026-08-20T00:00:00.000Z",
    cached: false,
    sources: {
      weather: probe("weather"),
      satellite: probe("satellite"),
      "light-pollution": probe("light-pollution"),
      tianditu: probe("tianditu"),
      "local-dark-sky": probe("local-dark-sky"),
    },
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
    expect(getDataSourceHealth).toHaveBeenCalledWith(false, "best_match");
    expect(result.headers.get("x-weather-probe-model")).toBe("best_match");
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
    expect(getDataSourceHealth).toHaveBeenCalledWith(true, "best_match");
  });
});


describe("model-aware diagnostic routing", () => {
  it("keeps explicit ICON degraded when visibility is missing", async () => {
    getDataSourceHealth.mockResolvedValue(response({ status: "degraded", model: "icon", scoringAvailable: false, missingScoringFields: ["能见度"] }));
    const { GET } = await loadRoute();
    const result = await GET(request("?model=icon"));
    expect(getDataSourceHealth).toHaveBeenCalledWith(false, "icon");
    expect(result.headers.get("x-weather-probe-model")).toBe("icon");
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect((await result.json()).missingScoringFields).toContain("能见度");
  });
  it("keeps an explicit model and does not cache degraded capability", async () => {
    getDataSourceHealth.mockResolvedValue(response({ status: "degraded", model: "gfs", scoringAvailable: false }));
    const { GET } = await loadRoute();
    const result = await GET(request("?model=gfs"));
    expect(getDataSourceHealth).toHaveBeenCalledWith(false, "gfs");
    expect(result.headers.get("x-weather-probe-model")).toBe("gfs");
    expect(result.headers.get("cache-control")).toContain("no-store");
  });
  it("rejects an unknown model without probing", async () => {
    const { GET } = await loadRoute();
    const result = await GET(request("?model=invalid"));
    expect(result.status).toBe(400);
    expect(getDataSourceHealth).not.toHaveBeenCalled();
  });
});
