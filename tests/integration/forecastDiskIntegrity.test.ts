import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-09-13T08:00:00Z");
const LIMIT = 6 * 60 * 60_000;
const KEY = "icon|1|30.182|108.882";
const OFFSET_CONTRACT_KEY = `surface-v3-offset|${KEY}`;
const PRE_OFFSET_KEY = `surface-v2-past1|${KEY}`;
let directory: string;
let providerCalls = 0;

function payload(fetchedAt: string) {
  const metadata = { source: "Open-Meteo", model: "icon", fetchedAt, stale: false, units: {} };
  return { metadata, locations: [{ locationId: "loc-0", modelLatitude: 30.18,
    modelLongitude: 108.88, modelElevation: 1402, timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28800, fetchedAt, metadata, requestedLatitude: 30.182,
    requestedLongitude: 108.882, hourly: [{ time: "2026-09-13T21:00", cloudCover: 8,
      precipitation: 0.2, windSpeed: 3 }] }] };
}
function writeDisk(value: unknown, key = KEY): void {
  const folder = path.join(directory, "forecast-cache");
  fs.mkdirSync(folder, { recursive: true });
  const filename = path.join(folder, `${Buffer.from(key).toString("base64url")}.json`);
  fs.writeFileSync(filename, JSON.stringify(value), "utf8");
  // A recently touched file must never rejuvenate old source data.
  fs.utimesSync(filename, new Date(NOW), new Date(NOW));
}
async function request(cacheOnly = false) {
  const { GET } = await import("@/app/api/forecast/route");
  return GET(new NextRequest("http://localhost/api/forecast?latitude=30.182&longitude=108.882&days=1&model=icon" + (cacheOnly ? "&cache_only=1" : "")));
}
beforeEach(() => {
  vi.resetModules();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "star-forecast-integrity-test-"));
  vi.stubEnv("FORECAST_ENABLE_DISK_CACHE", "1");
  vi.stubEnv("OBSERVING_SNAPSHOT_DIR", directory);
  vi.stubEnv("FORECAST_STALE_TTL_MS", String(LIMIT));
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  providerCalls = 0;
  vi.doMock("@/lib/forecast", async () => ({
    ...await vi.importActual<typeof import("@/lib/forecast")>("@/lib/forecast"),
    clampForecastDays: (days: number) => days,
    fetchForecastByCoords: vi.fn(async () => {
      providerCalls += 1;
      throw new Error("天气接口返回 HTTP 429");
    }),
  }));
});
afterEach(() => {
  vi.doUnmock("@/lib/forecast");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});
describe("forecast disk fallback original-age gate", () => {
  it("retains legacy fresh data only as stale in cache-only reads", async () => {
    writeDisk(payload(new Date(NOW - 60_000).toISOString()));
    const response = await request(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-data-stale")).toBe("true");
    expect((await response.json()).locations[0].metadata.stale).toBe(true);
  });
  it("accepts fresh data only under the offset-contract cache key", async () => {
    writeDisk(payload(new Date(NOW - 60_000).toISOString()), OFFSET_CONTRACT_KEY);
    const response = await request(true);
    expect(response.status).toBe(200);
    expect((await response.json()).locations[0].metadata.stale).toBe(false);
  });
  it("retains same-point pre-offset v2 weather facts only as stale without spending provider quota", async () => {
    const timestamp = new Date(NOW - 60_000).toISOString();
    const value = payload(timestamp);
    value.locations[0]!.timezone = "Asia/Shanghai";
    value.locations[0]!.utcOffsetSeconds = 0;
    writeDisk(value, PRE_OFFSET_KEY);
    const response = await request(true);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-forecast-cache")).toBe("cache-only-pre-offset-disk");
    expect(response.headers.get("x-data-stale")).toBe("true");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(providerCalls).toBe(0);
    const body = await response.json();
    expect(body.metadata.stale).toBe(true);
    expect(body.locations[0].metadata.stale).toBe(true);
    expect(body.locations[0].fetchedAt).toBe(timestamp);
    expect(body.locations[0].hourly[0]).toMatchObject({
      cloudCover: 8,
      precipitation: 0.2,
      windSpeed: 3,
    });
  });
  it("rejects a pre-offset v2 record whose recorded request coordinates do not match", async () => {
    const value = payload(new Date(NOW - 60_000).toISOString());
    value.locations[0]!.requestedLatitude = 31;
    writeDisk(value, PRE_OFFSET_KEY);
    const response = await request(true);
    expect(response.status).toBe(429);
    expect(response.headers.get("x-forecast-cache")).toBe("cache-only-miss");
    expect(providerCalls).toBe(0);
  });
  it("rejects expired pre-offset v2 facts using original source age", async () => {
    writeDisk(payload(new Date(NOW - LIMIT - 1).toISOString()), PRE_OFFSET_KEY);
    const response = await request(true);
    expect(response.status).toBe(429);
    expect(providerCalls).toBe(0);
  });
  it("returns pre-offset v2 facts as stale after an upstream failure, never as fresh", async () => {
    const timestamp = new Date(NOW - 60_000).toISOString();
    const value = payload(timestamp);
    value.locations[0]!.utcOffsetSeconds = 0;
    writeDisk(value, PRE_OFFSET_KEY);
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-forecast-cache")).toBe("stale-pre-offset-disk");
    expect(response.headers.get("x-data-stale")).toBe("true");
    expect(providerCalls).toBe(1);
    const body = await response.json();
    expect(body.locations[0].fetchedAt).toBe(timestamp);
    expect(body.locations[0].metadata.stale).toBe(true);
  });
  it("preserves an explicit UTC zero in the offset-contract cache namespace", async () => {
    const value = payload(new Date(NOW - 60_000).toISOString());
    value.locations[0]!.timezone = "UTC";
    value.locations[0]!.utcOffsetSeconds = 0;
    writeDisk(value, OFFSET_CONTRACT_KEY);
    const response = await request(true);
    expect(response.status).toBe(200);
    expect((await response.json()).locations[0].utcOffsetSeconds).toBe(0);
  });
  it("never treats a recently fetched legacy record as a fresh normal response", async () => {
    writeDisk(payload(new Date(NOW - 60_000).toISOString()));
    const response = await request();
    expect(response.headers.get("x-forecast-cache")).toBe("stale-disk");
    expect((await response.json()).locations[0].metadata.stale).toBe(true);
  });

  it("allows the exact six-hour boundary only as explicitly stale raw data", async () => {
    const timestamp = new Date(NOW - LIMIT).toISOString();
    writeDisk(payload(timestamp));
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-forecast-cache")).toBe("stale-disk");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.json();
    expect(body.locations[0].metadata.stale).toBe(true);
    expect(body.locations[0].fetchedAt).toBe(timestamp);
  });
  it.each([LIMIT + 1, 7 * 86400000])("rejects source age %i despite fresh filesystem mtime", async (age) => {
    writeDisk(payload(new Date(NOW - age).toISOString()));
    const response = await request();
    expect(response.status).toBe(502);
    expect((await response.json()).locations).toBeUndefined();
  });
  it.each(["", "2026-09-13T12:00:00Z"])("rejects missing/future source timestamp %s", async (timestamp) => {
    writeDisk(payload(timestamp));
    expect((await request()).status).toBe(502);
  });
  it("rejects malformed decoded disk records without crashing", async () => {
    writeDisk({ locations: [null] });
    expect((await request()).status).toBe(502);
  });
  it("cannot raise disk retention to two days through configuration", async () => {
    vi.stubEnv("FORECAST_STALE_TTL_MS", String(48 * 60 * 60_000));
    writeDisk(payload(new Date(NOW - LIMIT - 1).toISOString()));
    expect((await request()).status).toBe(502);
  });
});
