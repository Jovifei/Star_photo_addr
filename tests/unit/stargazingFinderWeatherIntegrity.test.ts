import { afterEach, describe, expect, it, vi } from "vitest";
import { addFinderDays, FINDER_LOCATIONS, getShanghaiDate } from "@/data/observingSites/catalog";

function rawForecast(latitude: number, longitude: number, date: string, omitField?: string) {
  const time = Array.from({ length: 33 }, (_, index) => {
    const hour = 7 + index;
    const day = addFinderDays(date, Math.floor(hour / 24));
    return `${day}T${String(hour % 24).padStart(2, "0")}:00`;
  });
  const values = (value: number) => time.map(() => value);
  const hourly: Record<string, unknown> = {
    time,
    relative_humidity_2m: values(60),
    dew_point_2m: values(8),
    precipitation_probability: values(0),
    weather_code: values(0),
    cloud_cover: values(8),
    cloud_cover_low: values(0),
    cloud_cover_mid: values(3),
    cloud_cover_high: values(4),
    precipitation: values(0),
    visibility: values(20_000),
    wind_speed_10m: values(1),
    wind_gusts_10m: values(2),
    temperature_2m: values(15),
  };
  if (omitField) delete hourly[omitField];
  return { latitude, longitude, elevation: 1402, timezone: "Asia/Shanghai", utc_offset_seconds: 28_800, hourly };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("finder weather batch integrity", () => {
  it("rejects calendar dates that JavaScript would otherwise normalize", async () => {
    vi.resetModules();
    const { isValidCalendarDate } = await import("@/lib/stargazingFinderWeather");
    expect(isValidCalendarDate("2026-02-30")).toBe(false);
    expect(isValidCalendarDate("2026-09-15")).toBe(true);
  });

  it("preserves each response identity and bounds upstream concurrency", async () => {
    vi.resetModules();
    const date = getShanghaiDate();
    let active = 0;
    let maximum = 0;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude")!.split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude")!.split(",").map(Number);
      active -= 1;
      return Response.json(latitudes.map((latitude, index) => rawForecast(latitude, longitudes[index]!, date)));
    }));
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const response = (await fetchFinderWeatherRange([date], new AbortController().signal, false, "icon"))[date]!;
    expect(maximum).toBeLessThanOrEqual(2);
    expect(response.stale).toBe(false);
    expect(response.model).toBe("icon");
    expect(response.sourceFetchedAt).toBeTruthy();
    const available = Object.values(response.data).filter((record) => record.status === "available");
    expect(available).toHaveLength(FINDER_LOCATIONS.length);
    expect(available.every((record) => record.fetchedAt && record.model === "icon" && record.utcOffsetSeconds === 28_800)).toBe(true);
    expect(available[0]?.provenance?.requestedLatitude).toBe(FINDER_LOCATIONS[0]?.latitude);
    expect(available[0]?.provenance?.modelElevation).toBe(1402);
  });

  it("fails closed when a required cloud layer is absent", async () => {
    vi.resetModules();
    const date = getShanghaiDate();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude")!.split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude")!.split(",").map(Number);
      return Response.json(latitudes.map((latitude, index) => rawForecast(latitude, longitudes[index]!, date, "cloud_cover_low")));
    }));
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const response = (await fetchFinderWeatherRange([date], new AbortController().signal, false, "icon"))[date]!;
    expect(response.stale).toBe(true);
    expect(Object.values(response.data).every((record) => record.status === "error")).toBe(true);
    expect(Object.values(response.data).every((record) => record.hourly === null)).toBe(true);
  });

  it("rejects a batch whose response order no longer maps to requested coordinates", async () => {
    vi.resetModules();
    const date = getShanghaiDate();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude")!.split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude")!.split(",").map(Number);
      return Response.json(latitudes.map((_, index) => {
        const sourceIndex = latitudes.length - 1 - index;
        return rawForecast(latitudes[sourceIndex]!, longitudes[sourceIndex]!, date);
      }));
    }));
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const response = (await fetchFinderWeatherRange([date], new AbortController().signal, false, "icon"))[date]!;
    expect(response.stale).toBe(true);
    expect(Object.values(response.data).some((record) => record.status === "error")).toBe(true);
  });
});
