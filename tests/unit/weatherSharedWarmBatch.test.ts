import { afterEach, describe, expect, it, vi } from "vitest";
import { addFinderDays, FINDER_LOCATIONS, getShanghaiDate } from "@/data/observingSites/catalog";
import { providerUnits } from "../fixtures/providerUnits";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function validBatch(url: string) {
  const params = new URL(url).searchParams;
  const start = params.get("start_date")!;
  const end = params.get("end_date")!;
  const count = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  const time = Array.from({ length: count * 24 }, (_, hour) =>
    `${addFinderDays(start, Math.floor(hour / 24))}T${String(hour % 24).padStart(2, "0")}:00`);
  const fields = ["relative_humidity_2m", "dew_point_2m", "precipitation_probability", "weather_code",
    "cloud_cover", "cloud_cover_low", "cloud_cover_mid", "cloud_cover_high", "precipitation",
    "visibility", "wind_speed_10m", "wind_gusts_10m", "temperature_2m"];
  const hourly = { time, ...Object.fromEntries(fields.map(field => [field,
    time.map(() => field === "visibility" ? 20_000 : field === "relative_humidity_2m" ? 60 : 1)])) };
  const latitudes = params.get("latitude")!.split(",").map(Number);
  const longitudes = params.get("longitude")!.split(",").map(Number);
  return latitudes.map((latitude, index) => ({ latitude, longitude: longitudes[index],
    elevation: 1000, timezone: "Asia/Shanghai", utc_offset_seconds: 28_800, hourly_units: providerUnits(), hourly }));
}

describe("shared prewarmed weather batches", () => {
  it("reuses the same validated source while keeping each product's window and freshness", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const date = getShanghaiDate();
    const fetchMock = vi.fn(async (url: string) => Response.json(validBatch(url)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange, fetchFireGlowWeather } = await import("@/lib/stargazingFinderWeather");
    const finder = (await fetchFinderWeatherRange([date], new AbortController().signal, true, "best_match"))[date]!;
    const calls = fetchMock.mock.calls.length;
    expect(calls).toBe(Math.ceil(FINDER_LOCATIONS.length / 24));
    const glow = await fetchFireGlowWeather(date, new AbortController().signal, false, "best_match");
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(glow.sourceFetchedAt).toBe(finder.sourceFetchedAt);
    const id = FINDER_LOCATIONS[0]!.id;
    expect(finder.data[id]!.hourly!.time[0]).toBe(`${date}T07:00`);
    expect(finder.data[id]!.hourly!.time.at(-1)).toBe(`${addFinderDays(date, 1)}T15:00`);
    expect(glow.data[id]!.hourly!.time[0]).toBe(`${date}T00:00`);
    expect(glow.data[id]!.hourly!.time.at(-1)).toBe(`${date}T23:00`);
    expect(glow.data[id]!.hourly!.cloud_cover_mid[7]).toBe(finder.data[id]!.hourly!.cloud_cover_mid[0]);

    await vi.advanceTimersByTimeAsync(31 * 60_000);
    const refreshed = await fetchFireGlowWeather(date, new AbortController().signal, true, "best_match");
    expect(fetchMock).toHaveBeenCalledTimes(calls * 2);
    expect(refreshed.stale).toBe(false);
    expect(refreshed.sourceFetchedAt).not.toBe(glow.sourceFetchedAt);
    await fetchFinderWeatherRange([date], new AbortController().signal, true, "best_match");
    expect(fetchMock).toHaveBeenCalledTimes(calls * 2);
  });

  it("coalesces simultaneous Finder and FireGlow requests", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const date = getShanghaiDate();
    const fetchMock = vi.fn(async (url: string) => Response.json(validBatch(url)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange, fetchFireGlowWeather } = await import("@/lib/stargazingFinderWeather");
    const [finder, glow] = await Promise.all([
      fetchFinderWeatherRange([date], new AbortController().signal, true, "best_match"),
      fetchFireGlowWeather(date, new AbortController().signal, true, "best_match"),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(FINDER_LOCATIONS.length / 24));
    expect(finder[date]!.sourceFetchedAt).toBe(glow.sourceFetchedAt);
  });

  it("does not share a raw batch across different forecast models", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const date = getShanghaiDate();
    const fetchMock = vi.fn(async (url: string) => Response.json(validBatch(url)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange, fetchFireGlowWeather } = await import("@/lib/stargazingFinderWeather");
    await fetchFinderWeatherRange([date], new AbortController().signal, true, "best_match");
    await fetchFireGlowWeather(date, new AbortController().signal, true, "icon");
    expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(FINDER_LOCATIONS.length / 24) * 2);
    expect(new Set(fetchMock.mock.calls.map(([url]) => new URL(url).searchParams.get("models"))))
      .toEqual(new Set([null, "icon_seamless"]));
  });

  it("keeps the previous observing night separate across Shanghai midnight", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-31T17:00:00Z"));
    const today = getShanghaiDate();
    const night = addFinderDays(today, -1);
    const fetchMock = vi.fn(async (url: string) => Response.json(validBatch(url)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange, fetchFireGlowWeather } = await import("@/lib/stargazingFinderWeather");
    const finder = (await fetchFinderWeatherRange([night], new AbortController().signal, true, "best_match"))[night]!;
    const glow = await fetchFireGlowWeather(today, new AbortController().signal, true, "best_match");
    expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(FINDER_LOCATIONS.length / 24) * 2);
    expect(finder.data[FINDER_LOCATIONS[0]!.id]!.hourly!.time[0]).toBe(`${night}T07:00`);
    expect(finder.data[FINDER_LOCATIONS[0]!.id]!.hourly!.time.at(-1)).toBe(`${today}T15:00`);
    expect(glow.data[FINDER_LOCATIONS[0]!.id]!.hourly!.time[0]).toBe(`${today}T00:00`);
  });

  it("still requests the next morning for the last supported ICON observing night", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
    const today = getShanghaiDate();
    const night = addFinderDays(today, 6);
    const fetchMock = vi.fn(async (url: string) => Response.json(validBatch(url)));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const finder = (await fetchFinderWeatherRange([night], new AbortController().signal, true, "icon"))[night]!;
    expect(finder.data[FINDER_LOCATIONS[0]!.id]!.hourly!.time.at(-1)).toBe(`${addFinderDays(night, 1)}T15:00`);
    expect(fetchMock.mock.calls.every(([url]) => new URL(url).searchParams.get("end_date") === addFinderDays(night, 1))).toBe(true);
  });
});
