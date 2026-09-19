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
