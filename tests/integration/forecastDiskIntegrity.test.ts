import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-09-13T08:00:00Z");
const LIMIT = 6 * 60 * 60_000;
const KEY = "icon|1|30.182|108.882";
let directory: string;

function payload(fetchedAt: string) {
  const metadata = { source: "Open-Meteo", model: "icon", fetchedAt, stale: false, units: {} };
  return { metadata, locations: [{ locationId: "loc-0", modelLatitude: 30.18,
    modelLongitude: 108.88, modelElevation: 1402, timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28800, fetchedAt, metadata, hourly: [{ time: "2026-09-13T21:00", cloudCover: 8 }] }] };
}
function writeDisk(value: unknown): void {
  const folder = path.join(directory, "forecast-cache");
  fs.mkdirSync(folder, { recursive: true });
  const filename = path.join(folder, `${Buffer.from(KEY).toString("base64url")}.json`);
  fs.writeFileSync(filename, JSON.stringify(value), "utf8");
  // A recently touched file must never rejuvenate old source data.
  fs.utimesSync(filename, new Date(NOW), new Date(NOW));
}
async function request() {
  const { GET } = await import("@/app/api/forecast/route");
  return GET(new NextRequest("http://localhost/api/forecast?latitude=30.182&longitude=108.882&days=1&model=icon"));
}
beforeEach(() => {
  vi.resetModules();
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "star-forecast-integrity-test-"));
  vi.stubEnv("FORECAST_ENABLE_DISK_CACHE", "1");
  vi.stubEnv("OBSERVING_SNAPSHOT_DIR", directory);
  vi.stubEnv("FORECAST_STALE_TTL_MS", String(LIMIT));
  vi.spyOn(Date, "now").mockReturnValue(NOW);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.doMock("@/lib/forecast", () => ({
    clampForecastDays: (days: number) => days,
    fetchForecastByCoords: vi.fn(async () => { throw new Error("天气接口返回 HTTP 429"); }),
  }));
});
afterEach(() => {
  vi.doUnmock("@/lib/forecast");
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});
describe("forecast disk fallback original-age gate", () => {
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
