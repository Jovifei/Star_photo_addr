import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";

function hourlyEntry() {
  const time = ["2026-09-06T05:00", "2026-09-06T06:00", "2026-09-06T07:00", "2026-09-06T08:00"];
  return {
    hourly: {
      time,
      cloud_cover: [80, 82, 84, 80],
      cloud_cover_low: [75, 78, 80, 76],
      cloud_cover_mid: [10, 10, 8, 8],
      cloud_cover_high: [5, 5, 5, 5],
      temperature_2m: [9, 9, 10, 11],
      relative_humidity_2m: [88, 90, 89, 86],
      precipitation: [0, 0, 0, 0],
      visibility: [20000, 20000, 20000, 20000],
      wind_speed_10m: [1.5, 1.7, 1.8, 2.0],
    },
  };
}

function request(query: string) {
  return new NextRequest(`http://localhost/api/cloudsea/snapshot?${query}`);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/cloudsea/snapshot", () => {
  it("maps AIFS to the real Open-Meteo provider model and uses real RH", async () => {
    let requested = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      requested = String(input);
      return new Response(JSON.stringify(CLOUD_SEA_SITES.map(() => hourlyEntry())), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=aifs"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(new URL(requested).searchParams.get("models")).toBe("ecmwf_aifs025_single");
    expect(new URL(requested).searchParams.get("hourly")).toContain("relative_humidity_2m");
    expect(body.source).toContain("Beta");
    const first = Object.values(body.sites)[0] as {
      morning: { humidity: number | null; probabilityLabel: string | null };
    };
    expect(first.morning.humidity).toBeGreaterThan(80);
    expect(first.morning.probabilityLabel).toMatch(/\/100$/);
  });

  it("returns an upstream error instead of fabricated weather when Open-Meteo fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      throw new Error("provider unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-07&model=icon"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.sites).toBeUndefined();
    expect(String(body.error)).toContain("provider unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
