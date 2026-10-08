import { describe, expect, it } from "vitest";
import { nightAstronomyFacts } from "@/lib/nightAstronomyFacts";
import { evaluateNight } from "@/lib/scoring";
import type { Location, LocationForecast } from "@/lib/types";
const location: Location = { id: "a1", name: "a1", latitude: 30, longitude: 120, elevation: null, source: "自定义" };
const now = Date.now();
const forecast = { locationId: "a1", modelLatitude: 30, modelLongitude: 120, modelElevation: 0, timezone: "Asia/Shanghai", utcOffsetSeconds: 28800, fetchedAt: new Date(now).toISOString(), metadata: { source: "Open-Meteo", model: "icon", fetchedAt: new Date(now).toISOString(), stale: false, units: {} }, hourly: Array.from({length:10}, (_,i) => ({time: i < 4 ? `2026-10-07T${20+i}:00` : `2026-10-08T0${i-4}:00`, cloudCover: 20, precipitation: 0, windSpeed: 2})) } as LocationForecast;
describe("independent night astronomy facts", () => {
  it("retains geometric facts without weather visibility and never enables a score", () => {
    expect(evaluateNight(forecast, location, "2026-10-07")).toBeNull();
    const facts = nightAstronomyFacts(forecast, location, "2026-10-07", now);
    expect(facts?.moonIllumination).toBeGreaterThanOrEqual(0);
    expect(facts?.moonIllumination).toBeLessThanOrEqual(1);
    expect(facts?.sampleCount).toBe(10);
    expect(facts?.darkHours).toBeGreaterThanOrEqual(0);
    expect(facts?.heightAssumption).toBe("sea-level");
    expect(location.elevation).toBeNull();
  });
  it("integrates elapsed dark hours rather than counting samples in polar winter", () => {
    const polarForecast = { ...forecast, timezone: "UTC", utcOffsetSeconds: 0,
      hourly: forecast.hourly.map(hour => ({...hour, time: hour.time.replace("2026-10-07", "2026-12-21").replace("2026-10-08", "2026-12-22")})) };
    const polarLocation = {...location, latitude: 89, longitude: 0};
    expect(nightAstronomyFacts(polarForecast, polarLocation, "2026-12-21", now)?.darkHours).toBe(9);
    const gapForecast = {...polarForecast, hourly: polarForecast.hourly.filter((_, index) => index !== 5)};
    // Two hours surrounding a missing observation are not certified darkness.
    expect(nightAstronomyFacts(gapForecast, polarLocation, "2026-12-21", now)?.darkHours).toBe(7);
  });
  it("rejects stale, missing offset, invalid coordinates and incomplete nights", () => {
    expect(nightAstronomyFacts({...forecast, metadata: {...forecast.metadata!, stale:true}},location,"2026-10-07",now)).toBeNull();
    expect(nightAstronomyFacts({...forecast, utcOffsetSeconds: NaN},location,"2026-10-07",now)).toBeNull();
    expect(nightAstronomyFacts(forecast,{...location,latitude:91},"2026-10-07",now)).toBeNull();
    expect(nightAstronomyFacts({...forecast, locationId:"other"},location,"2026-10-07",now)).toBeNull();
    expect(nightAstronomyFacts({...forecast, timezone:"INVALID"},location,"2026-10-07",now)).toBeNull();
    expect(nightAstronomyFacts({...forecast,hourly:forecast.hourly.slice(0,3)},location,"2026-10-07",now)).toBeNull();
  });
});
