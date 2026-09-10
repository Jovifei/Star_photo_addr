import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function request(query: string) {
  return new NextRequest(`http://localhost/api/geocode?${query}`);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/geocode", () => {
  it("returns a curated site without depending on the remote geocoder", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/geocode/route");
    const response = await GET(request("q=%E5%A4%AA%E5%AD%90%E5%B0%96&count=8&language=zh"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Geocode-Source")).toBe("curated-observing-sites");
    expect(body.results[0]).toMatchObject({
      name: "临安太子尖",
      latitude: 30.175219,
      longitude: 118.897919,
      featureCode: "CURATED_OBSERVING_SITE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
