import { expect, it } from "vitest";
import { collectWeatherEvidence, qualifyPressure, qualifySurface, qualifyTopic } from "../../scripts/weather-evidence.mjs";
const now = Date.parse("2026-10-08T12:00Z");
const sourceFetchedAt = new Date(now).toISOString();
const expected = { latitude: 31.23, longitude: 121.47, model: "icon" };
const hour = { epochSeconds: now / 1000, time: "2026-10-08T20:00", utcOffsetSeconds: 28800, cloudCover: 10, cloudLow: 5, cloudMid: 6, cloudHigh: 7, temperature: 20, humidity: 60, dewPoint: 10, precipitationProbability: 0, precipitation: 0, windSpeed: 1, windGust: 2, weatherCode: 0 };
const metadata = { model: "icon", stale: false, timeAxisVersion: "epoch-v1", sourceFetchedAt, fetchedAt: sourceFetchedAt };
const point = { requestedLatitude: 31.23, requestedLongitude: 121.47, modelLatitude: 31.25, modelLongitude: 121.5, fetchedAt: sourceFetchedAt, timezone: "Asia/Shanghai", metadata, hourly: [hour] };
it("keeps ICON facts partial without borrowing visibility and never passes science", () => {
  const result = qualifySurface({ metadata, locations: [point] }, expected, now);
  expect(result.status).toBe("PARTIAL_INPUT");
  expect(result.completeHours).toBe(0);
  expect(result.missing).toMatchObject({ visibility: 1 });
  expect(result.scientificAccuracy).toBe("NOT_RUN");
});
it("rejects successful wrong-model/coordinate/source/clock bodies", () => {
  const good = { ...point, hourly: [{ ...hour, visibility: 20000 }] };
  expect(qualifySurface({ metadata, locations: [good] }, expected, now).status).toBe("QUALIFIED_INPUT");
  for (const invalid of [{ ...good, requestedLongitude: 102 }, { ...good, metadata: { ...metadata, model: "gfs" } }, { ...good, metadata: { ...metadata, sourceFetchedAt: null } }, { ...good, hourly: [{ ...good.hourly[0], time: "2026-10-08T21:00" }] }]) {
    expect(qualifySurface({ metadata, locations: [invalid] }, expected, now).status).toBe("INVALID_INPUT");
  }
});
it("requires distinct complete pressure levels and does not qualify wall-clock legacy", () => {
  const level = { pressure: 900, cloudCover: 60, humidity: 80, temperature: 5, heightMsl: 1000 };
  const body = { ...point, ...metadata, source: "Open-Meteo", modelElevation: 10, profilesByEpoch: { [hour.epochSeconds]: Array(6).fill(level) } };
  expect(qualifyPressure(body, expected, now).status).toBe("PARTIAL_INPUT");
  body.profilesByEpoch[hour.epochSeconds] = [1000, 975, 950, 925, 900, 850].map(pressure => ({ ...level, pressure }));
  expect(qualifyPressure(body, expected, now).status).toBe("QUALIFIED_INPUT");
  expect(qualifyPressure({ ...body, timeAxisVersion: undefined }, expected, now).status).toBe("INVALID_INPUT");
});
it("rejects topic HTTP200 without per-site original sources", () => {
  const body = { model: "icon", date: "2026-10-08", stale: false, sites: { a: { morning: { score: 90 }, evening: { score: 80 } } } };
  expect(qualifyTopic(body, { model: "icon", date: body.date, product: "fireglow" }, now).status).toBe("INVALID_INPUT");
});
it("stops the whole 48-row matrix on429 and records remaining rows NOT_RUN", async () => {
  let calls = 0;
  const result = await collectWeatherEvidence({ base: "http://localhost", date: "2026-10-08", now, fetcher: async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls += 1; expect(url.searchParams.get("cache_only")).toBe("1"); expect(url.searchParams.has("refresh")).toBe(false);
    return new Response(JSON.stringify({ error: "cooldown" }), { status: 429, headers: { "Retry-After": "600" } });
  } });
  expect(calls).toBe(1); expect(result.rows).toHaveLength(48); expect((result.rows as Array<{ status: string }>).every(row => row.status === "NOT_RUN")).toBe(true);
});
