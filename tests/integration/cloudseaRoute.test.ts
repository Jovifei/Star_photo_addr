import { NextRequest } from "next/server";
import { providerUnits } from "../fixtures/providerUnits";
import { PROVIDER_VALIDATION_VERSION } from "@/lib/providerWeatherIntegrity";
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

function fixtureTimes(date = "2026-09-06") {
  return TIME.map((time) => `${date}${time.slice(10)}`);
}
function hourlyEntry(date = "2026-09-06") {
  return {
    latitude: 30, longitude: 120, timezone: "Asia/Shanghai", utc_offset_seconds: 28800,
    hourly_units: providerUnits(),
    hourly: {
      time: fixtureTimes(date),
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
  875: 1250,
  850: 1500,
  825: 1750,
  800: 2000,
  775: 2250,
  750: 2500,
  725: 2750,
  700: 3000,
  650: 3600,
  600: 4200,
  500: 5600,
};

function pressureEntry(date = "2026-09-06") {
  const times = fixtureTimes(date);
  const hourly: Record<string, unknown> = {
    time: times.map(time => Date.parse(time + ":00+08:00") / 1000),
    temperature_2m: times.map(() => 10),
  };
  for (const pressure of PRESSURE_LEVELS) {
    const cloudy = [950, 925].includes(pressure);
    const temperature =
      pressure === 950
        ? 8
        : pressure === 925
          ? 10
          : 12 - (1000 - pressure) * 0.012;
    hourly[`cloud_cover_${pressure}hPa`] = times.map(() => (cloudy ? 82 : 10));
    hourly[`relative_humidity_${pressure}hPa`] = times.map(() =>
      cloudy ? 92 : 55,
    );
    hourly[`temperature_${pressure}hPa`] = times.map(() => temperature);
    hourly[`geopotential_height_${pressure}hPa`] = times.map(
      () => HEIGHTS[pressure],
    );
  }
  return {
    elevation: 400,
    latitude: 30,
    longitude: 120,
    timezone: "Asia/Shanghai",
    utc_offset_seconds: 28800,
    hourly_units: providerUnits("unixtime"),
    hourly,
  };
}

function combinedEntry(date = "2026-09-06") {
  const pressure = pressureEntry(date);
  return { ...pressure, hourly: { ...hourlyEntry(date).hourly, ...pressure.hourly } };
}

function missingPressureEntry(date = "2026-09-06") {
  const entry = combinedEntry(date);
  for (const level of PRESSURE_LEVELS) {
    Object.assign(entry.hourly, { [`cloud_cover_${level}hPa`]: TIME.map(() => null) });
  }
  return entry;
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
    const date = url.searchParams.get("start_date") ?? "2026-09-06";
    const payload = Array.from({ length: count }, () => combinedEntry(date));
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
  it("takes surface and pressure from the same native-grid response without a separate surface request", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      requested.push(url);
      const count = coordinateCount(url);
      const date = url.searchParams.get("start_date") ?? "2026-09-06";
      return Response.json(Array.from({ length: count }, () => combinedEntry(date)));
    }));
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=icon"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.surface.availableSites).toBe(CLOUD_SEA_SITES.length);
    expect(body.pressure.availableSites).toBe(CLOUD_SEA_SITES.length);
    expect(requested).toHaveLength(3);
    for (const url of requested) {
      expect(url.searchParams.get("elevation")).toBe(Array(coordinateCount(url)).fill("nan").join(","));
      expect(url.searchParams.get("hourly")).toContain("relative_humidity_2m");
      expect(url.searchParams.get("hourly")).toContain("geopotential_height_925hPa");
    }
  });
  it.each(["missing-unit", "wrong-unit", "range"])("does not publish provider surface data with %s", async fault => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const rows = Array.from({ length: coordinateCount(url) }, () => {
        const entry = combinedEntry(url.searchParams.get("start_date") ?? "2026-09-06");
        if (fault === "missing-unit") delete entry.hourly_units.wind_speed_10m;
        if (fault === "wrong-unit") entry.hourly_units.wind_speed_10m = "km/h";
        if (fault === "range") entry.hourly.cloud_cover_low = TIME.map(() => 999);
        return entry;
      });
      return Response.json(rows);
    }));
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-21&model=icon"));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.sites).toBeUndefined();
  });
  it.each(["timezone", "offset", "coordinate"])("rejects an untrustworthy fixed-Beijing provider identity (%s)", async fault => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      return Response.json(Array.from({ length: coordinateCount(url) }, () => {
        const entry = combinedEntry(url.searchParams.get("start_date") ?? "2026-09-06");
        if (fault === "timezone") entry.timezone = "UTC";
        if (fault === "offset") entry.utc_offset_seconds = 0;
        if (fault === "coordinate") entry.latitude = 91;
        return entry;
      }));
    }));
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    expect((await GET(request("date=2026-09-21&model=icon"))).status).toBe(502);
  });
  it("keeps valid surface weather when only pressure fields have invalid units", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const count = coordinateCount(url);
      const date = url.searchParams.get("start_date") ?? "2026-09-06";
      return Response.json(Array.from({ length: count }, () => {
        const entry = combinedEntry(date);
        entry.hourly_units.geopotential_height_925hPa = "ft";
        return entry;
      }));
    }));

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=gfs"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.surface.status).toBe("available");
    expect(body.pressure.status).toBe("unavailable");
    expect(body.pressure.availableSites).toBe(0);
    expect(body.sites["cs-taizijian"].morning.score).toBeNull();
    expect(body.sites["cs-taizijian"].morning.pressureStatus).toBe("unavailable");
    expect(response.headers.get("X-Cloudsea-Cache")).toBe("degraded");
  });

  it("defaults to GFS so every catalog site uses one pressure model with third-day coverage", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", successfulFetch(requested));

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-21"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.model).toBe("gfs");
    expect(body.providerValidationVersion).toBe(PROVIDER_VALIDATION_VERSION);
    expect(requested.length).toBeGreaterThan(0);
    expect(
      requested.every((url) => url.searchParams.get("models") === "ncep_gfs025"),
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
        const date = url.searchParams.get("start_date") ?? "2026-09-06";
        pressureRequests += 1;
        activePressureRequests += 1;
        maxPressureRequests = Math.max(maxPressureRequests, activePressureRequests);
        await new Promise((resolve) => setTimeout(resolve, 20));
        activePressureRequests -= 1;
        return new Response(
          JSON.stringify(Array.from({ length: count }, () => combinedEntry(date))),
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

  it("keeps AIFS surface and profile facts but withholds scores without a proven native pressure grid", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", successfulFetch(requested));

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=aifs"));
    const body = await response.json();

    expect(response.status).toBe(200);
    const pressureUrls = requested.filter((url) =>
      (url.searchParams.get("hourly") ?? "").includes("geopotential_height_"),
    );
    expect(pressureUrls).toHaveLength(3);
    expect(pressureUrls[0]?.searchParams.get("models")).toBe(
      "ecmwf_aifs025_single",
    );
    const surfaceFields = (pressureUrls[0]?.searchParams.get("hourly") ?? "").split(",");
    expect(surfaceFields).toContain("relative_humidity_2m");
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
        coverage: { scoreableHours: number; pressureHours: number };
      };
    };
    expect(first.morning.humidity).toBeGreaterThan(80);
    expect(first.morning.conditionLabel).toBeNull();
    expect(first.morning.cloudTopM).toBeNull();
    expect(first.morning.pressureStatus).toBe("available");
    expect(first.morning.coverage).toEqual(expect.objectContaining({ scoreableHours: 0, pressureHours: 4 }));
  });

  it("does not reuse a snapshot with the old score version as fresh", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    const cloudsea = await import("@/lib/cloudsea");
    const build = cloudsea.buildCloudSeaSnapshot;
    vi.spyOn(cloudsea, "buildCloudSeaSnapshot").mockImplementationOnce((...args) => ({ ...build(...args), scoreVersion: "legacy-score-v1" }));
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const first = await GET(request("date=2026-09-06&model=icon"));
    expect(first.headers.get("X-Cloudsea-Cache")).toBe("degraded");
    const firstCalls = fetchMock.mock.calls.length;
    const second = await GET(request("date=2026-09-06&model=icon"));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(firstCalls);
    expect(second.headers.get("X-Cloudsea-Cache")).toBe("fresh");
    expect((await second.json()).scoreVersion).toBe(cloudsea.CLOUD_SEA_SCORE_VERSION);
  });

  it("repairs a retained current-version legacy snapshot on the API and cache-only path", async () => {
    const fetchMock = successfulFetch();
    vi.stubGlobal("fetch", fetchMock);
    const cloudsea = await import("@/lib/cloudsea");
    const build = cloudsea.buildCloudSeaSnapshot;
    let retained: ReturnType<typeof build> | undefined;
    vi.spyOn(cloudsea, "buildCloudSeaSnapshot").mockImplementationOnce((...args) => {
      const snapshot = build(...args);
      const site = snapshot.sites["cs-damingshan"];
      const legacy = { ...site.evening, cloudPosition: "in" as const, positionLabel: "山顶处于云层内",
        cloudBaseM: 1550, cloudTopM: 1550, cloudTopUpperM: 2070, score: 22, peakScore: 22,
        summary: "数值模式压力剖面显示山顶海拔（1489m）落在低层云 deck（1550–1550m）内，存在云雾包裹风险。 窗口 3/3 个目标时次参与平均条件指数。" };
      retained = { ...snapshot, sites: { ...snapshot.sites, "cs-damingshan": { ...site, evening: legacy } } };
      return retained;
    });
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const fresh = await GET(request("date=2026-09-06&model=gfs"));
    expect(fresh.headers.get("X-Cloudsea-Cache")).toBe("fresh");
    const freshWindow = (await fresh.json()).sites["cs-damingshan"].evening;
    const calls = fetchMock.mock.calls.length;
    const cached = await GET(request("date=2026-09-06&model=gfs&cache_only=1"));
    expect(cached.headers.get("X-Cloudsea-Cache")).toBe("cache-only");
    const cachedWindow = (await cached.json()).sites["cs-damingshan"].evening;
    expect(cachedWindow).toEqual(freshWindow);
    expect(cachedWindow).toMatchObject({ cloudPosition: "in", score: 22, peakScore: 22,
      cloudBaseM: 1550, cloudTopM: 1550, cloudTopUpperM: 2070, positionLabel: "山顶接近或可能处于云层" });
    expect(cachedWindow.summary).toContain("上下各150m余量");
    expect(cachedWindow.summary).toContain("窗口 3/3");
    expect(cachedWindow.summary).not.toContain("落在低层云 deck");
    expect(retained!.sites["cs-damingshan"].evening.summary).toContain("落在低层云 deck");
    expect(fetchMock).toHaveBeenCalledTimes(calls);
  });

  it("does not cache a complete-looking legacy pressure snapshot without quality provenance", async () => {
    vi.stubGlobal("fetch", successfulFetch());
    const cloudsea = await import("@/lib/cloudsea");
    const build = cloudsea.buildCloudSeaSnapshot;
    vi.spyOn(cloudsea, "buildCloudSeaSnapshot").mockImplementationOnce((...args) => {
      const legacy = { ...build(...args) };
      delete legacy.pressureQualitySchema;
      delete legacy.pressureQualityValidatorVersion;
      legacy.pressure = {
        status: "available",
        receivedSites: CLOUD_SEA_SITES.length,
        availableSites: CLOUD_SEA_SITES.length,
        partialSites: 0,
        totalSites: CLOUD_SEA_SITES.length,
        failedSites: 0,
      };
      return legacy;
    });
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");

    const fresh = await GET(request("date=2026-09-06&model=gfs"));
    expect(fresh.headers.get("X-Cloudsea-Cache")).toBe("degraded");
    expect((await fresh.json()).refreshError).toMatch(/压力层|质量/);

    const cacheOnly = await GET(request("date=2026-09-06&model=gfs&cache_only=1"));
    expect(cacheOnly.status).toBe(429);
    expect(cacheOnly.headers.get("X-Cloudsea-Cache")).toBe("cache-only-miss");
  });

  it("requests ground wind in the m/s units used by CloudSea scoring and UI", async () => {
    const requested: URL[] = [];
    vi.stubGlobal("fetch", successfulFetch(requested));

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=icon"));

    expect(response.status).toBe(200);
    expect(requested).toHaveLength(3);
    expect(requested.every(url => url.searchParams.get("wind_speed_unit") === "ms")).toBe(true);
  });

  it("does not cache a pressure-degraded snapshot as fresh for the next-day retry", async () => {
    let pressureAvailable = false;
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const count = coordinateCount(url);
      const date = url.searchParams.get("start_date") ?? "2026-09-06";
      return new Response(
        JSON.stringify(Array.from({ length: count }, () => pressureAvailable ? combinedEntry(date) : missingPressureEntry(date))),
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
      const date = url.searchParams.get("start_date") ?? "2026-09-06";
      const rows = Array.from({ length: count }, () => combinedEntry(date));
      if (!surfaceRecovered && rows[0] && url.searchParams.get("latitude")?.split(",")[0] === String(CLOUD_SEA_SITES[0].latitude)) {
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
      receivedSites: CLOUD_SEA_SITES.length,
      partialSites: 0,
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
          expect(window, `${site.id}.${phase}.${field}`).toHaveProperty(field);
          if (["lowCloud", "midCloud", "highCloud", "humidity", "windSpeed"].includes(field)) {
            expect(window[field]).toEqual(expect.any(Number));
          } else {
            expect(window[field] === null || Number.isFinite(window[field]), `${site.id}.${phase}.${field}`).toBe(true);
          }
        }
        for (const field of textFields) {
          expect(window, `${site.id}.${phase}.${field}`).toHaveProperty(field);
          expect(window[field] === null || typeof window[field] === "string", `${site.id}.${phase}.${field}`).toBe(true);
        }
        if (window.score === null) {
          expect(window.conditionLabel).toBeNull();
          expect(window.probabilityLabel).toBeNull();
          expect(window.cloudPosition).toBe("unknown");
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
    expect(fetchMock).toHaveBeenCalledTimes(6); // Three bounded batches, two attempts each.
  });

  it("does not retry a provider 429 and forwards its Retry-After cooldown", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(
      { reason: "Daily API request limit exceeded" },
      { status: 429, headers: { "Retry-After": "600" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-07&model=icon"));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(fetchMock).toHaveBeenCalledTimes(2); // Two in-flight workers, neither retries or starts a third batch.
    expect(new Set(fetchMock.mock.calls.map(call => String(call[0]))).size).toBe(2);
  });

  it("preserves an active provider cooldown when a concurrent request fails with 502", async () => {
    const { noteOpenMeteoRateLimit } = await import("@/lib/forecast");
    const fetchMock = vi.fn(async () => {
      noteOpenMeteoRateLimit("600");
      throw new Error("provider HTTP 502");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-08&model=icon"));

    expect(response.status).toBe(502);
    expect(response.headers.get("Retry-After")).toBe("600");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps real surface data but fails vertical cloud-sea conclusions closed when pressure is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        return new Response(
          JSON.stringify(Array.from({ length: coordinateCount(url) }, () => missingPressureEntry())),
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
