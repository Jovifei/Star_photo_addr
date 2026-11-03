import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

const DATE = "2026-11-03";
const NOW = `${DATE}T01:45:00.000Z`;
const SITE = OBSERVING_SITES[0]!;
const state = vi.hoisted(() => ({ calls: 0, data: {} as Record<string, FinderWeatherRecord> }));

vi.mock("@/lib/stargazingFinderWeather", () => ({
  fetchFireGlowWeather: vi.fn(async () => {
    state.calls += 1;
    return { data: state.data };
  }),
  isFinderDateAllowed: () => true,
}));

function record(precipitation = 0.8, sourceFetchedAt = NOW, noonOnly = false): FinderWeatherRecord {
  const time = noonOnly ? [`${DATE}T12:00`] : Array.from({ length: 96 }, (_, index) =>
    `${DATE}T${String(Math.floor(index / 4)).padStart(2, "0")}:${String((index % 4) * 15).padStart(2, "0")}`,
  );
  const values = (value: number) => time.map(() => value);
  return {
    status: "available", model: "icon", fetchedAt: sourceFetchedAt,
    hourly: {
      time, weather_code: values(61), cloud_cover: values(75),
      cloud_cover_low: values(8), cloud_cover_mid: values(40), cloud_cover_high: values(30),
      relative_humidity_2m: values(80), dew_point_2m: values(12),
      precipitation_probability: values(90), precipitation: values(precipitation),
      visibility: values(20_000), wind_speed_10m: values(3), wind_gusts_10m: values(6),
      temperature_2m: values(18),
    },
  };
}

function request(extra = "") {
  return new NextRequest(`http://localhost/api/fireglow/snapshot?date=${DATE}&model=icon${extra}`);
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW));
  state.calls = 0;
  state.data = { [SITE.id]: record() };
});
afterEach(() => vi.useRealTimers());

describe("fireglow weather outcomes through the real scorer and route", () => {
  it("returns and caches rain-only outcomes without inventing scores or repeating provider calls", async () => {
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const first = await GET(request());
    expect(first.status).toBe(200);
    const payload = await first.json();
    expect(payload.sites[SITE.id].evening).toMatchObject({
      status: "rain-excluded", score: null, peakTime: null, lowCloud: 8, precipitationMm: 0.8,
    });
    expect(payload.stale).toBe(false);
    expect(payload.provenance.sourcesBySite[SITE.id][0].sourceFetchedAt).toBe(NOW);
    const second = await GET(request());
    expect(second.headers.get("x-fireglow-cache")).toBe("memory");
    const retained = await GET(request("&cache_only=1"));
    expect(retained.status).toBe(200);
    expect((await retained.json()).provenance.sourcesBySite[SITE.id][0].sourceFetchedAt).toBe(NOW);
    expect(state.calls).toBe(1);
  });

  it("does not keep an old clear forecast merely because the new rainy result has a null score", async () => {
    state.data = { [SITE.id]: record(0) };
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const first = await GET(request());
    expect((await first.json()).sites[SITE.id].evening.score).not.toBeNull();
    state.data = { [SITE.id]: record(0.8) };
    const refresh = await GET(request("&refresh=1"));
    const payload = await refresh.json();
    expect(payload.sites[SITE.id].evening.status).toBe("rain-excluded");
    expect(payload.sites[SITE.id].evening.score).toBeNull();
    expect(payload.refreshError).toBeUndefined();
    expect(state.calls).toBe(2);
    const cooldown = await GET(request("&refresh=1"));
    expect(cooldown.headers.get("x-fireglow-cache")).toBe("refresh-cooldown");
    expect((await cooldown.json()).stale).toBe(true);
    expect(state.calls).toBe(2);
  });

  it("keeps a no-solar-window result distinct from an upstream failure", async () => {
    state.data = { [SITE.id]: record(0, NOW, true) };
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).sites[SITE.id].evening).toMatchObject({
      status: "no-solar-window", score: null, bandLabel: "无晨昏窗口",
    });
  });

  it("still rejects genuinely missing twilight fields and does not cache them as a good result", async () => {
    const value = record();
    value.hourly!.cloud_cover_high = value.hourly!.time.map(() => null);
    state.data = { [SITE.id]: value };
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(request());
    expect(response.status).toBe(502);
    const retained = await GET(request("&cache_only=1"));
    expect(retained.status).toBe(429);
    expect(state.calls).toBe(1);
  });

  it("does not rejuvenate retained rainy evidence when its original source is old", async () => {
    const acquired = new Date(Date.parse(NOW) - 45 * 60_000).toISOString();
    state.data = { [SITE.id]: record(0.8, acquired) };
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(request());
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.stale).toBe(true);
    expect(payload.provenance.sourcesBySite[SITE.id][0].sourceFetchedAt).toBe(acquired);
    const retained = await GET(request("&cache_only=1"));
    expect((await retained.json()).stale).toBe(true);
    expect(state.calls).toBe(1);
  });
});
