import { providerUnits } from "../fixtures/providerUnits";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addFinderDays, FINDER_LOCATIONS, getShanghaiDate } from "@/data/observingSites/catalog";

let snapshotDirectory: string | undefined;

afterEach(() => {
  vi.doUnmock("@/lib/observingSites");
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
  if (snapshotDirectory) fs.rmSync(snapshotDirectory, { recursive: true, force: true });
  snapshotDirectory = undefined;
});

describe("FireGlow calendar-day weather window", () => {
  it.each([4, 5, 6])("carries D+%i dawn through the route and score without changing Finder's overnight window", async (forecastOffset) => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-18T00:00:00.000Z"));
    const today = getShanghaiDate();
    const date = addFinderDays(today, forecastOffset);
    const nextDate = addFinderDays(date, 1);
    snapshotDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "fireglow-window-"));
    vi.stubEnv("OBSERVING_SNAPSHOT_DIR", snapshotDirectory);
    // Keep the solar-time assertion deterministic while using a real catalog
    // identifier that is also returned by the live Finder weather pipeline.
    vi.doMock("@/lib/observingSites", () => ({
      OBSERVING_SITES: [{ id: FINDER_LOCATIONS[0]!.id, latitude: 30, longitude: 110 }],
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const params = new URL(String(input)).searchParams;
      const latitudes = params.get("latitude")!.split(",").map(Number);
      const longitudes = params.get("longitude")!.split(",").map(Number);
      const startDate = params.get("start_date")!;
      const endDate = params.get("end_date")!;
      const times: string[] = [];
      for (let current = startDate; current <= endDate; current = addFinderDays(current, 1)) {
        for (let hour = 0; hour < 24; hour += 1) {
          times.push(`${current}T${String(hour).padStart(2, "0")}:00`);
        }
      }
      const isDawn = (time: string) => {
        const hour = Number(time.slice(11, 13));
        return hour >= 4 && hour <= 6;
      };
      const low = times.map((time) => {
        if (time.slice(0, 10) === date && isDawn(time)) return 5;
        if (time.slice(0, 10) === date && Number(time.slice(11, 13)) <= 9) return null;
        return 0;
      });
      const mid = times.map((time) => {
        if (time.slice(0, 10) === date && isDawn(time)) return 40;
        if (time.slice(0, 10) === date && Number(time.slice(11, 13)) <= 9) return null;
        return 0;
      });
      const high = times.map((time) => {
        if (time.slice(0, 10) === date && isDawn(time)) return 20;
        if (time.slice(0, 10) === date && Number(time.slice(11, 13)) <= 9) return null;
        if (time.slice(0, 10) === nextDate && isDawn(time)) return 90;
        return 0;
      });
      const values = (value: number) => times.map(() => value);
      return Response.json(latitudes.map((latitude, index) => ({
        latitude,
        longitude: longitudes[index],
        elevation: 1200,
        timezone: "Asia/Shanghai",
        utc_offset_seconds: 28_800, hourly_units: providerUnits(),
        hourly: {
          time: times,
          relative_humidity_2m: values(60),
          dew_point_2m: values(10),
          precipitation_probability: values(0),
          weather_code: values(1),
          cloud_cover: times.map((_, timeIndex) => (low[timeIndex] ?? 0) + (mid[timeIndex] ?? 0) + (high[timeIndex] ?? 0)),
          cloud_cover_low: low,
          cloud_cover_mid: mid,
          cloud_cover_high: high,
          precipitation: values(0),
          visibility: values(20_000),
          wind_speed_10m: values(1),
          wind_gusts_10m: values(2),
          temperature_2m: values(15),
        },
      })));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(new NextRequest(
      `http://localhost/api/fireglow/snapshot?date=${date}&model=icon`,
    ));
    const body = await response.json() as {
      date: string;
      sites: Record<string, { morning: { score: number | null; midCloud: number | null; highCloud: number | null; peakTime: string | null } }>;
    };

    expect(response.status).toBe(200);
    expect(body.date).toBe(date);
    const dawn = body.sites[FINDER_LOCATIONS[0]!.id]!.morning;
    expect(dawn.score).not.toBeNull();
    expect(dawn.midCloud).toBe(40);
    expect(dawn.highCloud).toBe(20);
    expect(["04:00", "05:00", "06:00"]).toContain(dawn.peakTime);
    const fireGlowFetchCount = fetchMock.mock.calls.length;
    expect(fireGlowFetchCount).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.slice(0, fireGlowFetchCount).every(([input]) =>
      new URL(String(input)).searchParams.get("end_date") === date,
    )).toBe(true);

    const { fetchFinderWeatherRange } = await import("@/lib/stargazingFinderWeather");
    const finder = await fetchFinderWeatherRange([date], new AbortController().signal, true, "icon");
    const finderTimes = finder[date]!.data[FINDER_LOCATIONS[0]!.id]!.hourly!.time;
    expect(finderTimes[0]).toBe(`${date}T07:00`);
    expect(finderTimes.at(-1)).toBe(`${nextDate}T15:00`);
    expect(fetchMock.mock.calls.slice(fireGlowFetchCount).every(([input]) =>
      new URL(String(input)).searchParams.get("end_date") === nextDate,
    )).toBe(true);
  });
});
