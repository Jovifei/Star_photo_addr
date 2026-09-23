import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { PRESSURE_LEVELS } from "@/lib/pressure";

const TIME = [
  "2026-09-06T05:00",
  "2026-09-06T06:00",
  "2026-09-06T07:00",
  "2026-09-06T08:00",
  "2026-09-06T17:00",
  "2026-09-06T18:00",
  "2026-09-06T19:00",
];

function hourlyEntry() {
  return {
    hourly: {
      time: TIME,
      cloud_cover_low: [75, 78, 80, 76, 75, 78, 80],
      cloud_cover_mid: [10, 10, 8, 8, 10, 10, 8],
      cloud_cover_high: [5, 5, 5, 5, 5, 5, 5],
      relative_humidity_2m: [88, 90, 89, 86, 88, 90, 89],
      precipitation: [0, 0, 0, 0, 0, 0, 0],
      wind_speed_10m: [1.5, 1.7, 1.8, 2.0, 1.5, 1.7, 1.8],
    },
  };
}

const HEIGHTS: Record<number, number> = {
  1000: 100,
  975: 300,
  950: 500,
  925: 750,
  900: 1000,
  850: 1500,
  800: 2000,
  700: 3000,
  600: 4200,
  500: 5600,
};

function pressureEntry() {
  const hourly: Record<string, unknown> = {
    time: TIME,
    temperature_2m: [9, 9, 10, 11],
  };
  for (const pressure of PRESSURE_LEVELS) {
    const cloudy = [950, 925, 900].includes(pressure);
    const temperature =
      pressure === 950
        ? 8
        : pressure === 925
          ? 10
          : 12 - (1000 - pressure) * 0.012;
    hourly[`cloud_cover_${pressure}hPa`] = TIME.map(() => (cloudy ? 82 : 10));
    hourly[`relative_humidity_${pressure}hPa`] = TIME.map(() =>
      cloudy ? 92 : 55,
    );
    hourly[`temperature_${pressure}hPa`] = TIME.map(() => temperature);
    hourly[`geopotential_height_${pressure}hPa`] = TIME.map(
      () => HEIGHTS[pressure],
    );
  }
  return {
    elevation: 400,
    timezone: "Asia/Shanghai",
    utc_offset_seconds: 28800,
    hourly,
  };
}

function coordinateCount(url: URL): number {
  return (url.searchParams.get("latitude") ?? "")
    .split(",")
    .filter(Boolean).length;
}

function request(query: string) {
  return new NextRequest(`http://localhost/api/cloudsea/snapshot?${query}`);
}

function successfulFetch(requested?: URL[]) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    requested?.push(url);
    const count = coordinateCount(url);
    const hourly = url.searchParams.get("hourly") ?? "";
    const payload = hourly.includes("geopotential_height_")
      ? Array.from({ length: count }, () => pressureEntry())
      : Array.from({ length: count }, () => hourlyEntry());
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/cloudsea/snapshot", () => {
  it("defaults to GFS so every catalog site uses one pressure model with third-day coverage", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", successfulFetch(requested));

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-21"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.model).toBe("gfs");
    expect(requested.length).toBeGreaterThan(0);
    expect(
      requested.every((url) => url.searchParams.get("models") === "gfs_seamless"),
    ).toBe(true);
    expect(body.pressure.availableSites).toBe(CLOUD_SEA_SITES.length);
  });

  it("bounds pressure fan-out to two batches while completing all catalog sites", async () => {
    let activePressureRequests = 0;
    let maxPressureRequests = 0;
    let pressureRequests = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const count = coordinateCount(url);
        const hourly = url.searchParams.get("hourly") ?? "";
        if (!hourly.includes("geopotential_height_")) {
          return new Response(
            JSON.stringify(Array.from({ length: count }, () => hourlyEntry())),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        pressureRequests += 1;
        activePressureRequests += 1;
        maxPressureRequests = Math.max(maxPressureRequests, activePressureRequests);
        await new Promise((resolve) => setTimeout(resolve, 20));
        activePressureRequests -= 1;
        return new Response(
          JSON.stringify(Array.from({ length: count }, () => pressureEntry())),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-21&model=icon"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(pressureRequests).toBe(3);
    expect(maxPressureRequests).toBe(2);
    expect(body.pressure.availableSites).toBe(CLOUD_SEA_SITES.length);
  });

  it("uses real surface RH plus batched pressure profiles for AIFS", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", successfulFetch(requested));

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=aifs"));
    const body = await response.json();

    expect(response.status).toBe(200);
    const surfaceUrl = requested.find(
      (url) =>
        !(url.searchParams.get("hourly") ?? "").includes(
          "geopotential_height_",
        ),
    );
    const pressureUrls = requested.filter((url) =>
      (url.searchParams.get("hourly") ?? "").includes("geopotential_height_"),
    );
    expect(surfaceUrl).toBeDefined();
    expect(surfaceUrl?.searchParams.get("models")).toBe(
      "ecmwf_aifs025_single",
    );
    const surfaceFields = (surfaceUrl?.searchParams.get("hourly") ?? "").split(",");
    expect(surfaceFields).toContain("relative_humidity_2m");
    expect(surfaceFields).not.toContain("temperature_2m");
    expect(surfaceFields).not.toContain("visibility");
    expect(surfaceFields).not.toContain("cloud_cover");
    expect(pressureUrls.length).toBeGreaterThan(0);
    expect(
      pressureUrls.every(
        (url) =>
          url.searchParams.get("models") === "ecmwf_aifs025_single",
      ),
    ).toBe(true);
    expect(pressureUrls[0]?.searchParams.get("hourly")).toContain(
      "geopotential_height_925hPa",
    );

    expect(body.source).toContain("pressure-level");
    expect(body.pressure.status).toBe("available");
    expect(body.pressure.availableSites).toBe(CLOUD_SEA_SITES.length);
    const first = Object.values(body.sites)[0] as {
      morning: {
        humidity: number | null;
        conditionLabel: string | null;
        cloudTopM: number | null;
        pressureStatus: string;
      };
    };
    expect(first.morning.humidity).toBeGreaterThan(80);
    expect(first.morning.conditionLabel).toMatch(/\/100$/);
    expect(first.morning.cloudTopM).not.toBeNull();
    expect(first.morning.pressureStatus).toBe("available");
  });

  it("does not cache a pressure-degraded snapshot as fresh for the next-day retry", async () => {
    let pressureAvailable = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const hourly = url.searchParams.get("hourly") ?? "";
      const count = coordinateCount(url);
      if (hourly.includes("geopotential_height_")) {
        if (!pressureAvailable) throw new Error("pressure temporarily unavailable");
        return new Response(
          JSON.stringify(Array.from({ length: count }, () => pressureEntry())),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify(Array.from({ length: count }, () => hourlyEntry())),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const first = await GET(request("date=2026-09-21&model=icon"));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.pressure.status).toBe("unavailable");

    pressureAvailable = true;
    const callsAfterDegradedResponse = fetchMock.mock.calls.length;
    const second = await GET(request("date=2026-09-21&model=icon"));
    const secondBody = await second.json();

    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterDegradedResponse);
    expect(second.status).toBe(200);
    expect(secondBody.pressure.status).toBe("available");
    expect(secondBody.pressure.availableSites).toBe(CLOUD_SEA_SITES.length);
  });

  it("marks partial surface coverage degraded and does not cache it as fresh", async () => {
    let surfaceRecovered = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const count = coordinateCount(url);
      const hourly = url.searchParams.get("hourly") ?? "";
      if (hourly.includes("geopotential_height_")) {
        return new Response(
          JSON.stringify(Array.from({ length: count }, () => pressureEntry())),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      const rows = Array.from({ length: count }, () => ({
        hourly: { ...hourlyEntry().hourly },
      }));
      if (!surfaceRecovered && rows[0]) {
        rows[0].hourly.wind_speed_10m = Array(TIME.length).fill(null);
      }
      return new Response(JSON.stringify(rows), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const first = await GET(request("date=2026-09-21&model=icon"));
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.surface.status).toBe("partial");
    expect(firstBody.surface.availableSites).toBe(CLOUD_SEA_SITES.length - 1);
    expect(firstBody.refreshError).toContain("地面天气");
    expect(first.headers.get("X-Cloudsea-Cache")).toBe("degraded");
    expect(first.headers.get("Cache-Control")).toBe("no-store");

    const callsAfterPartial = fetchMock.mock.calls.length;
    surfaceRecovered = true;
    const second = await GET(request("date=2026-09-21&model=icon"));
    const secondBody = await second.json();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(callsAfterPartial);
    expect(secondBody.surface.status).toBe("available");
    expect(secondBody.surface.availableSites).toBe(CLOUD_SEA_SITES.length);
    expect(second.headers.get("X-Cloudsea-Cache")).toBe("fresh");
  });

  it("returns every declared cloudsea field for both windows at every catalog site", async () => {
    vi.stubGlobal("fetch", successfulFetch());
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-21&model=icon"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pressure).toEqual({
      status: "available",
      availableSites: CLOUD_SEA_SITES.length,
      totalSites: CLOUD_SEA_SITES.length,
      failedSites: 0,
    });
    expect(Object.keys(body.sites)).toHaveLength(CLOUD_SEA_SITES.length);

    const numericFields = [
      "score",
      "cloudBaseM",
      "cloudTopM",
      "altitudeDiffM",
      "lowCloud",
      "midCloud",
      "highCloud",
      "humidity",
      "windSpeed",
    ];
    const textFields = [
      "conditionLevel",
      "conditionLabel",
      "probabilityLevel",
      "probabilityLabel",
      "cloudPosition",
      "positionLabel",
      "peakTime",
      "pressureTime",
      "pressureStatus",
      "pressureConfidence",
      "summary",
    ];

    for (const site of CLOUD_SEA_SITES) {
      const siteScore = body.sites[site.id];
      expect(siteScore).toBeDefined();
      for (const phase of ["morning", "evening"] as const) {
        const window = siteScore[phase];
        for (const field of numericFields) {
          expect(window[field], `${site.id}.${phase}.${field}`).toEqual(
            expect.any(Number),
          );
        }
        for (const field of textFields) {
          expect(window[field], `${site.id}.${phase}.${field}`).toEqual(
            expect.any(String),
          );
        }
        expect(window.inversion, `${site.id}.${phase}.inversion`).toEqual(
          expect.objectContaining({ status: expect.any(String) }),
        );
      }
    }
  });

  it("returns an upstream error instead of fabricated surface weather when Open-Meteo fails", async () => {
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

  it("keeps real surface data but fails vertical cloud-sea conclusions closed when pressure is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        const hourly = url.searchParams.get("hourly") ?? "";
        if (hourly.includes("geopotential_height_")) {
          throw new Error("pressure unavailable");
        }
        return new Response(
          JSON.stringify(CLOUD_SEA_SITES.map(() => hourlyEntry())),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=icon"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.pressure.status).toBe("unavailable");
    expect(body.pressure.availableSites).toBe(0);
    expect(body.source).toContain("pressure-level model profile unavailable");
    const first = Object.values(body.sites)[0] as {
      morning: {
        humidity: number | null;
        score: number | null;
        cloudTopM: number | null;
        pressureStatus: string;
      };
    };
    expect(first.morning.humidity).toBeGreaterThan(80);
    expect(first.morning.score).toBeNull();
    expect(first.morning.cloudTopM).toBeNull();
    expect(first.morning.pressureStatus).toBe("unavailable");
  });

  it("does not serve an arbitrarily old in-memory snapshot after upstream failure", async () => {
    let now = Date.parse("2026-09-06T00:00:00.000Z");
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const first = await GET(request("date=2026-09-06&model=icon"));
    expect(first.status).toBe(200);

    now += 6 * 60 * 60_000 + 1;
    fetchMock.mockImplementation(async () => {
      throw new Error("provider unavailable after stale ttl");
    });

    const second = await GET(request("date=2026-09-06&model=icon"));
    const body = await second.json();
    expect(second.status).toBe(502);
    expect(body.sites).toBeUndefined();
    expect(String(body.error)).toContain("provider unavailable after stale ttl");
  });
});
