import { afterEach, describe, expect, it, vi } from "vitest";
const POINT = { latitude: 30.182, longitude: 108.882 };
function response(model = "icon", stale = false) {
  const fetchedAt = new Date().toISOString();
  const metadata = { source: "Open-Meteo", model, fetchedAt, stale, units: {} };
  return Response.json({ metadata, locations: [{ locationId: "loc-0", modelLatitude: 30.18, modelLongitude: 108.88, modelElevation: 1402, timezone: "Asia/Shanghai", utcOffsetSeconds: 28_800, fetchedAt, metadata, hourly: [{ time: "2026-09-13T21:00" }] }] });
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("bounded shared candidate loader", () => {
  it("coalesces two components and repeated cache renders into one request", async () => {
    vi.resetModules(); const fetchMock = vi.fn(async () => response()); vi.stubGlobal("fetch", fetchMock);
    const { requestCandidateForecast } = await import("@/lib/candidateForecastClient");
    const requests = Array.from({ length: 30 }, () => requestCandidateForecast(POINT, "icon"));
    await Promise.all(requests);
    await requestCandidateForecast(POINT, "icon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("bounds concurrency to two across different coordinates", async () => {
    vi.resetModules(); let active = 0, maximum = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { active++; maximum = Math.max(maximum, active); await new Promise((resolve) => setTimeout(resolve, 2)); active--; return response(); }));
    const { requestCandidateForecast } = await import("@/lib/candidateForecastClient");
    await Promise.all(Array.from({ length: 20 }, (_, i) => requestCandidateForecast({ ...POINT, latitude: 30 + i / 100 }, "icon")));
    expect(maximum).toBe(2);
  });
  it("caches 429 failure, including manual retries inside cooldown", async () => {
    vi.resetModules(); const fetchMock = vi.fn(async () => new Response("limited", { status: 429 })); vi.stubGlobal("fetch", fetchMock);
    const { requestCandidateForecast } = await import("@/lib/candidateForecastClient");
    await expect(requestCandidateForecast(POINT, "icon")).rejects.toThrow("429");
    await expect(requestCandidateForecast(POINT, "icon", 14, Date.now())).rejects.toThrow("429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("separates models and forces a completed success only once per refresh revision", async () => {
    vi.resetModules(); const fetchMock = vi.fn(async (url: string) => response(new URL(url, "http://localhost").searchParams.get("model")!)); vi.stubGlobal("fetch", fetchMock);
    const { requestCandidateForecast } = await import("@/lib/candidateForecastClient");
    await requestCandidateForecast(POINT, "icon");
    await Promise.all([requestCandidateForecast(POINT, "icon", 14, 123), requestCandidateForecast(POINT, "icon", 14, 123)]);
    await requestCandidateForecast(POINT, "gfs");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("propagates envelope/header stale without inventing a fresh timestamp", async () => {
    vi.resetModules(); const raw = response(); const body = await raw.json(); body.metadata.stale = true;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
    const { requestCandidateForecast } = await import("@/lib/candidateForecastClient");
    const result = await requestCandidateForecast(POINT, "icon");
    expect(result.metadata!.stale).toBe(true);
    expect(result.fetchedAt).toBe(body.locations[0].fetchedAt);
  });
});
