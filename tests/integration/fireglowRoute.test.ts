import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  mode: "empty" as "empty" | "valid",
  fetchCalls: 0,
}));

vi.mock("@/lib/stargazingFinderWeather", () => ({
  fetchFinderWeatherRange: vi.fn(async () => {
    state.fetchCalls += 1;
    return {};
  }),
  isFinderDateAllowed: () => true,
}));

vi.mock("@/lib/fireglow", () => ({
  buildFireGlowSnapshot: (date: string, model: string) => ({
    date,
    model,
    generatedAt: new Date().toISOString(),
    source: "test",
    stale: false,
    sites: {
      "test-site": {
        evening:
          state.mode === "valid"
            ? {
                score: 72,
                band: "medium",
                bandLabel: "中烧",
                probabilityLevel: "p60",
                probabilityLabel: "72/100",
                vividness: 0.72,
                momentLabel: "云隙",
                peakTime: "18:30",
                deckCloud: 35,
                lowCloud: 20,
                midCloud: 35,
                highCloud: 40,
                visibilityKm: 18,
                sunAltitude: -2,
                goldenTime: "18:20",
                blueTime: "18:50",
                astroTime: "19:10",
                reason: "test",
              }
            : {
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
    expect(body.sites["test-site"].evening.score).toBe(72);
  });
});
