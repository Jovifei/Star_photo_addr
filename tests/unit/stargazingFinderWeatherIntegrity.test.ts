import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

let rawTestDirectory: string | undefined;

afterEach(() => {
  vi.unstubAllEnvs();
  if (rawTestDirectory) fs.rmSync(rawTestDirectory, { recursive: true, force: true });
  rawTestDirectory = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("finder weather batch integrity", () => {
  it("reuses covered raw batches across dates, persists fetch time over restart, and rejects expired disk data", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    // Keep the full 7.5-hour cache lifecycle before Shanghai midnight so the
    // next request does not silently require an additional raw-forecast day.
    vi.setSystemTime(new Date("2026-10-01T00:00:00.000Z"));
    rawTestDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "finder-raw-test-"));
    vi.stubEnv("OBSERVING_SNAPSHOT_DIR", rawTestDirectory);
    vi.stubEnv("FINDER_ENABLE_DISK_CACHE", "1");
    const date = getShanghaiDate();
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams;
      const latitudes = params.get("latitude")!.split(",").map(Number);
      const longitudes = params.get("longitude")!.split(",").map(Number);
      const count = Math.round((Date.parse(params.get("end_date")!) - Date.parse(params.get("start_date")!)) / 86_400_000) + 1;
      return Response.json(latitudes.map((latitude, index) => {
        const first = rawForecast(latitude, longitudes[index]!, date);
        const hours = Array.from({ length: count * 24 }, (_, hour) => `${addFinderDays(date, Math.floor(hour / 24))}T${String(hour % 24).padStart(2, "0")}:00`);
        first.hourly = Object.fromEntries(Object.entries(first.hourly).map(([key, values]) => [key, key === "time" ? hours : hours.map(() => (values as number[])[0])]));
        return first;
      }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const [first, simultaneous] = await Promise.all([
      fetchFinderWeatherRange([date], new AbortController().signal, true, "icon"),
      fetchFinderWeatherRange([addFinderDays(date, 1)], new AbortController().signal, true, "icon"),
    ]);
    const original = first[date]!;
    expect(simultaneous[addFinderDays(date, 1)]!.sourceFetchedAt).toBe(original.sourceFetchedAt);
    expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(FINDER_LOCATIONS.length / 24));
    const calls = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    const next = addFinderDays(date, 1);
    const reused = (await fetchFinderWeatherRange([next], new AbortController().signal, true, "icon"))[next]!;
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(reused.sourceFetchedAt).toBe(original.sourceFetchedAt);
    expect(reused.stale).toBe(false);
    expect(fs.readdirSync(path.join(rawTestDirectory, "finder-raw-cache-v1"))).toHaveLength(calls);
    vi.resetModules();
    const restarted = await import("@/lib/stargazingFinderWeather");
    const diskReused = (await restarted.fetchFinderWeatherRange([next], new AbortController().signal, true, "icon"))[next]!;
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    expect(diskReused.sourceFetchedAt).toBe(original.sourceFetchedAt);
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000);
    vi.resetModules();
    const expiredRestart = await import("@/lib/stargazingFinderWeather");
    const refreshed = (await expiredRestart.fetchFinderWeatherRange([date], new AbortController().signal, true, "icon"))[date]!;
    expect(fetchMock.mock.calls.length).toBeGreaterThan(calls);
    expect(refreshed.sourceFetchedAt).not.toBe(original.sourceFetchedAt);
    await vi.advanceTimersByTimeAsync(4 * 60 * 60_000);
    fetchMock.mockImplementation(async () => Response.json({ reason: "Daily API request limit exceeded" }, { status: 429 }));
    vi.resetModules();
    const failedRestart = await import("@/lib/stargazingFinderWeather");
    const abortedConsumer = new AbortController();
    const abortedResult = failedRestart.fetchFinderWeatherRange([next], abortedConsumer.signal, true, "icon");
    const otherResult = failedRestart.fetchFinderWeatherRange([next], new AbortController().signal, true, "icon");
    abortedConsumer.abort();
    const [, survivingResult] = await Promise.allSettled([abortedResult, otherResult]);
    expect(survivingResult.status).toBe("fulfilled");
    if (survivingResult.status !== "fulfilled") throw survivingResult.reason;
    const stale = survivingResult.value[next]!;
    expect(stale.stale).toBe(true);
    expect(stale.sourceFetchedAt).toBe(refreshed.sourceFetchedAt);
    expect(Object.values(stale.data).every((record) => record.status === "stale" && record.hourly)).toBe(true);
    const failedCalls = fetchMock.mock.calls.length;
    vi.resetModules();
    const quotaRestart = await import("@/lib/stargazingFinderWeather");
    const quotaFallback = (await quotaRestart.fetchFinderWeatherRange([next], new AbortController().signal, true, "icon"))[next]!;
    expect(quotaFallback.sourceFetchedAt).toBe(refreshed.sourceFetchedAt);
    expect(quotaFallback.stale).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(failedCalls);
    await vi.advanceTimersByTimeAsync(3 * 60 * 60_000);
    vi.resetModules();
    const tooOldRestart = await import("@/lib/stargazingFinderWeather");
    const tooOld = (await tooOldRestart.fetchFinderWeatherRange([next], new AbortController().signal, true, "icon"))[next]!;
    expect(Object.values(tooOld.data).every((record) => record.hourly === null)).toBe(true);
    vi.useRealTimers();
  });

  it("keeps a coalesced provider request alive when the first consumer aborts", async () => {
    vi.resetModules();
    const date = getShanghaiDate();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const providerSignals: AbortSignal[] = [];
    const fetchMock = vi.fn(async (url: string, options: RequestInit) => {
      providerSignals.push(options.signal as AbortSignal);
      await gate;
      expect(options.signal?.aborted).toBe(false);
      const params = new URL(url).searchParams;
      const latitude = params.get("latitude")!.split(",").map(Number);
      const longitude = params.get("longitude")!.split(",").map(Number);
      return Response.json(latitude.map((value, index) => rawForecast(value, longitude[index]!, date)));
    });
    vi.stubGlobal("fetch", fetchMock);
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const firstController = new AbortController();
    const first = fetchFinderWeatherRange([date], firstController.signal, true, "icon");
    const second = fetchFinderWeatherRange([date], new AbortController().signal, true, "icon");
    firstController.abort();
    expect(providerSignals.every((signal) => signal !== firstController.signal && !signal.aborted)).toBe(true);
    release();
    const results = await Promise.allSettled([first, second]);
    expect(results[1].status).toBe("fulfilled");
    if (results[1].status === "fulfilled") {
      expect(results[1].value[date]!.stale).toBe(false);
      expect(Object.values(results[1].value[date]!.data).every((record) => record.hourly)).toBe(true);
    }
    expect(fetchMock).toHaveBeenCalledTimes(Math.ceil(FINDER_LOCATIONS.length / 24));
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

  it("allows an absent optional visibility series while preserving null visibility values", async () => {
    vi.resetModules();
    const date = getShanghaiDate();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const parsed = new URL(url);
      const latitudes = parsed.searchParams.get("latitude")!.split(",").map(Number);
      const longitudes = parsed.searchParams.get("longitude")!.split(",").map(Number);
      return Response.json(latitudes.map((latitude, index) => rawForecast(
        latitudes[index]!,
        longitudes[index]!,
        date,
        "visibility",
      )));
    }));
    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const response = (await fetchFinderWeatherRange([date], new AbortController().signal, false, "icon"))[date]!;
    const available = Object.values(response.data).filter((record) => record.status === "available");
    expect(available).toHaveLength(FINDER_LOCATIONS.length);
    expect(available.every((record) => record.hourly?.visibility.every((value) => value === null))).toBe(true);
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
