import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIRE_GLOW_SCORE_VERSION } from "@/lib/fireglow";
import { PROVIDER_VALIDATION_VERSION } from "@/lib/providerWeatherIntegrity";

const disk = vi.hoisted(() => ({ bytes: "", writes: vi.fn(), fetchWeather: vi.fn() }));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { default: {
    ...actual,
    existsSync: (file: unknown) => String(file).includes("fireglow-cache-version-test") || actual.existsSync(file as string),
    readFileSync: (file: unknown) => String(file).includes("fireglow-cache-version-test") ? disk.bytes : actual.readFileSync(file as string, "utf8"),
    writeFileSync: disk.writes,
  } };
});
vi.mock("@/lib/stargazingFinderWeather", () => ({
  isFinderDateAllowed: () => true,
  fetchFireGlowWeather: disk.fetchWeather,
}));

function cached(versions: Record<string, unknown>) {
  const now = new Date().toISOString();
  return JSON.stringify({
    date: "2026-10-24", model: "gfs", generatedAt: now, stale: false,
    provenance: { version: 1, sourcesBySite: { test: [{ provider: "Open-Meteo", dataset: "surface", model: "gfs", sourceFetchedAt: now }] } },
    sites: { test: { evening: { score: 72 }, morning: { score: null } } },
    ...versions,
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("OBSERVING_SNAPSHOT_DIR", "E:/project/Star_photo_addr/tmp/fireglow-cache-version-test");
  disk.writes.mockClear();
  disk.fetchWeather.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("Fireglow persisted score contract", () => {
  it.each([
    {},
    { scoreModelVersion: "fireglow-v2", providerValidationVersion: PROVIDER_VALIDATION_VERSION },
    { scoreModelVersion: FIRE_GLOW_SCORE_VERSION, providerValidationVersion: "old-provider" },
  ])("does not serve an unverified or old scoring cache: %j", async (versions) => {
    disk.bytes = cached(versions);
    const before = disk.bytes;
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(new NextRequest("http://localhost/api/fireglow/snapshot?date=2026-10-24&model=gfs&cache_only=1"));
    expect(response.status).toBe(429);
    expect((await response.json()).error).toBe("cache-only-miss");
    expect(disk.bytes).toBe(before);
    expect(disk.writes).not.toHaveBeenCalled();
    expect(disk.fetchWeather).not.toHaveBeenCalled();
  });

  it("serves a verified current cache without fetching or rewriting the original file", async () => {
    disk.bytes = cached({ scoreModelVersion: FIRE_GLOW_SCORE_VERSION, providerValidationVersion: PROVIDER_VALIDATION_VERSION });
    const before = disk.bytes;
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(new NextRequest("http://localhost/api/fireglow/snapshot?date=2026-10-24&model=gfs&cache_only=1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ scoreModelVersion: FIRE_GLOW_SCORE_VERSION, providerValidationVersion: PROVIDER_VALIDATION_VERSION });
    expect(disk.bytes).toBe(before);
    expect(disk.writes).not.toHaveBeenCalled();
    expect(disk.fetchWeather).not.toHaveBeenCalled();
  });
});
