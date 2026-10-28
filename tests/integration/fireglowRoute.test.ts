import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mode: "empty" as "empty" | "valid",
  fetchCalls: 0,
  sourceFetchedAt: null as string | null,
  buildStale: false,
  malformed: false,
}));

vi.mock("@/lib/stargazingFinderWeather", () => ({
  fetchFireGlowWeather: vi.fn(async () => {
    state.fetchCalls += 1;
    return { data: {} };
  }),
  isFinderDateAllowed: () => true,
}));

vi.mock("@/lib/fireglow", () => ({
  FIRE_GLOW_SCORE_VERSION: "fireglow-test-version",
  buildFireGlowSnapshot: (date: string, model: string) => ({
    date,
    model,
    generatedAt: new Date().toISOString(),
    provenance: {
      version: 1,
      sourcesBySite: {
        "test-site": state.malformed ? [null] : [{
          provider: "Open-Meteo",
          dataset: "surface",
          model,
          sourceFetchedAt: state.sourceFetchedAt ?? new Date().toISOString(),
          providerRunAt: null,
          observedAt: null,
        }],
      },
    },
    source: "test",
    stale: state.buildStale,
    sourceQuality: { version: 1, bySite: { "test-site": { status: "available", model } }, staleScope: "none" },
    sites: {
      "test-site": {
        evening: {
          score: state.mode === "valid" ? 72 : null,
          band: state.mode === "valid" ? "medium" : "unknown",
          bandLabel: state.mode === "valid" ? "中烧" : "数据不足",
          probabilityLevel: state.mode === "valid" ? "p60" : null,
          probabilityLabel: state.mode === "valid" ? "72/100" : null,
          vividness: state.mode === "valid" ? 0.72 : null,
          momentLabel: state.mode === "valid" ? "云隙" : "数据不足",
          peakTime: state.mode === "valid" ? "18:30" : null,
          deckCloud: state.mode === "valid" ? 35 : null,
          lowCloud: state.mode === "valid" ? 20 : null,
          midCloud: state.mode === "valid" ? 35 : null,
          highCloud: state.mode === "valid" ? 40 : null,
          visibilityKm: state.mode === "valid" ? 18 : null,
          sunAltitude: state.mode === "valid" ? -2 : null,
          goldenTime: state.mode === "valid" ? "18:20" : null,
          blueTime: state.mode === "valid" ? "18:50" : null,
          astroTime: state.mode === "valid" ? "19:10" : null,
          reason: state.mode === "valid" ? "test" : "test empty",
        },
        morning: {
          score: null,
          band: "unknown",
          bandLabel: "数据不足",
          probabilityLevel: null,
          probabilityLabel: null,
          vividness: null,
          momentLabel: "数据不足",
          peakTime: null,
          deckCloud: null,
          lowCloud: null,
          midCloud: null,
          highCloud: null,
          visibilityKm: null,
          sunAltitude: null,
          goldenTime: null,
          blueTime: null,
          astroTime: null,
          reason: "test empty",
        },
      },
    },
  }),
}));

function request(query: string) {
  return new NextRequest(`http://localhost/api/fireglow/snapshot?${query}`);
}

beforeEach(() => {
  vi.resetModules();
  state.mode = "empty";
  state.fetchCalls = 0;
  state.sourceFetchedAt = null;
  state.buildStale = false;
  state.malformed = false;
});

describe("GET /api/fireglow/snapshot", () => {
  it("does not return or cache an empty first snapshot as HTTP 200", async () => {
    const { GET } = await import("@/app/api/fireglow/snapshot/route");

    const empty = await GET(request("date=2026-09-20&model=icon"));
    expect(empty.status).toBe(502);
    expect((await empty.json()).error).toContain("未返回有效火烧云评分");

    state.mode = "valid";
    const recovered = await GET(request("date=2026-09-20&model=icon"));
    expect(recovered.status).toBe(200);
    expect((await recovered.json()).sites["test-site"].evening.score).toBe(72);
    expect(state.fetchCalls).toBe(2);
  });

  it("keeps the last valid snapshot when a forced refresh becomes empty", async () => {
    const { GET } = await import("@/app/api/fireglow/snapshot/route");

    state.mode = "valid";
    const first = await GET(request("date=2026-09-20&model=icon"));
    expect(first.status).toBe(200);

    state.mode = "empty";
    const degraded = await GET(request("date=2026-09-20&model=icon&refresh=1"));
    const body = await degraded.json();
    expect(degraded.status).toBe(200);
    expect(body.stale).toBe(true);
    expect(body.refreshError).toContain("未返回有效火烧云评分");
    expect(body.sourceQuality.staleScope).toBe("snapshot");
    expect(body.sites["test-site"].evening.score).toBe(72);
  });

  it("keeps a newly generated snapshot stale when its reused source is older than 30 minutes", async () => {
    state.mode = "valid";
    state.sourceFetchedAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const { GET } = await import("@/app/api/fireglow/snapshot/route");

    const response = await GET(request("date=2026-09-22&model=icon"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(Date.now() - Date.parse(body.generatedAt)).toBeLessThan(60_000);
    expect(body.stale).toBe(true);
    expect(body.sourceQuality.staleScope).toBe("site");
  });

  it("keeps unexplained stale snapshot-wide even when a source is also old", async () => {
    state.mode = "valid";
    state.buildStale = true;
    state.sourceFetchedAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(request("date=2026-09-23&model=icon"));
    expect((await response.json()).sourceQuality.staleScope).toBe("snapshot");
  });

  it("preserves site attribution in a cache-only aged response", async () => {
    state.mode = "valid";
    state.sourceFetchedAt = new Date(Date.now() - 45 * 60_000).toISOString();
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    await GET(request("date=2026-09-24&model=icon"));
    const response = await GET(request("date=2026-09-24&model=icon&cache_only=1"));
    expect(await response.json()).toMatchObject({ stale: true, sourceQuality: { staleScope: "site" } });
  });

  it("returns malformed source entries as stale rather than crashing", async () => {
    state.mode = "valid";
    state.malformed = true;
    const { GET } = await import("@/app/api/fireglow/snapshot/route");
    const response = await GET(request("date=2026-09-25&model=icon"));
    expect(response.status).toBe(200);
    expect((await response.json()).stale).toBe(true);
  });

  it("does not mark an impossible calendar source fresh after date normalization", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T12:00:00Z"));
    try {
      state.mode = "valid";
      state.sourceFetchedAt = "2026-02-30T12:00:00Z";
      const { GET } = await import("@/app/api/fireglow/snapshot/route");
      const response = await GET(request("date=2026-03-02&model=icon"));
      expect((await response.json()).stale).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
