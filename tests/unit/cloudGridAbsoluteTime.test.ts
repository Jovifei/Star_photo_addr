import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeEpochHours } from "@/lib/absoluteForecastTime";
import { fetchCloudGrid, getCloudCoverAtTime, getValuesAtTime, getWeatherValuesAtTime, resolveCloudGridEpoch } from "@/lib/cloudGrid";
import { requestForecastResponse } from "@/lib/forecastClient";
import type { CloudGridData, LocationForecast } from "@/lib/types";

vi.mock("@/lib/forecastClient", () => ({
  normalizeForecastDaysForModel: (days: number) => days,
  requestForecastResponse: vi.fn(),
}));
const epoch = Date.parse("2026-10-09T12:00:00Z") / 1000;
const samples = [{ latitude: 30, longitude: 120 }, { latitude: 35, longitude: 140 }];
function point(timezone: string, index: number, epochs = [epoch, epoch + 3600]): LocationForecast {
  return {
    locationId: `grid-${index}`, modelLatitude: samples[index].latitude, modelLongitude: samples[index].longitude,
    requestedLatitude: samples[index].latitude, requestedLongitude: samples[index].longitude,
    modelElevation: 0, timezone, utcOffsetSeconds: 0, fetchedAt: "2026-10-09T12:00:00Z",
    metadata: { source: "Open-Meteo", model: "best_match", fetchedAt: "2026-10-09T12:00:00Z", stale: false, units: {}, timeAxisVersion: "epoch-v1" },
    hourly: normalizeEpochHours(epochs, timezone).map((hour, i) => ({ ...hour, cloudHigh: index * 30 + i, cloudCover: index * 10 + i, precipitation: index + i, windSpeed: index + i + 2, windDirection: index * 90 })),
  };
}
function grid(forecasts = [point("Asia/Shanghai", 0), point("Asia/Tokyo", 1)]): CloudGridData {
  return { samples, forecasts, nightKeys: ["2026-10-09"], bounds: { north: 35, south: 30, east: 140, west: 120 }, model: "best_match", fetchedAt: "2026-10-09T12:00:00Z" };
}
beforeEach(() => vi.clearAllMocks());
describe("absolute grid sampling", () => {
  it("accepts distinct wall labels and shifted coverage for valid absolute axes", async () => {
    const forecasts = [point("Asia/Shanghai", 0), point("Asia/Tokyo", 1, [epoch - 3600, epoch, epoch + 3600])];
    vi.mocked(requestForecastResponse).mockResolvedValue({ data: { locations: forecasts }, stale: false });
    expect((await fetchCloudGrid(samples, ["2026-10-09"], 2)).forecasts).toEqual(forecasts);
  });
  it("samples all fields at one instant regardless of labels", () => {
    expect(getValuesAtTime(grid(), "2026-10-09T20:00", epoch).high).toEqual([0, 30]);
    expect(getCloudCoverAtTime(grid(), "2026-10-09T20:00", epoch)).toEqual([0, 10]);
    expect(getWeatherValuesAtTime(grid(), "2026-10-09T20:00", epoch).precipitation).toEqual([0, 1]);
    expect(getWeatherValuesAtTime(grid(), "2026-10-09T20:00", epoch).windSpeed).toEqual([2, 3]);
  });
  it("does not combine mixed-zone wall labels or array indices without an instant", () => {
    expect(getValuesAtTime(grid(), "2026-10-09T21:00").high).toEqual([null, null]);
    expect(getValuesAtTime(grid(), 0).high).toEqual([null, null]);
  });
  it("resolves the selected point clock and keeps a missing instant missing", () => {
    const data = grid();
    expect(resolveCloudGridEpoch(data, "2026-10-09T21:00", null, "Asia/Tokyo")).toBe(epoch);
    expect(resolveCloudGridEpoch(data, "2026-10-09T20:00", null, "Asia/Tokyo")).toBeNull();
    expect(getValuesAtTime(data, "2026-10-09T21:00", null).high).toEqual([null, null]);
    expect(resolveCloudGridEpoch(data, "2026-10-09T21:00", null, undefined)).toBeNull();
  });
  it("does not replace a missing selected point hour with grid0's clock", () => {
    const selected = point("Asia/Tokyo", 0, [epoch]);
    expect(resolveCloudGridEpoch(grid(), "2026-10-09T22:00", null, "Asia/Tokyo", selected)).toBeNull();
    expect(resolveCloudGridEpoch(grid(), "2026-10-09T21:00", null, "Asia/Tokyo", selected)).toBe(epoch);
  });
  it("resolves a whole-hour owning clock from a later grid axis when grid0 has a half-hour phase", () => {
    const data = grid([point("Asia/Kolkata", 0, [epoch - 1800, epoch + 1800]), point("Asia/Shanghai", 1)]);
    const active = resolveCloudGridEpoch(data, "2026-10-09T20:00", null, "Asia/Shanghai");
    expect(active).toBe(epoch);
    expect(getValuesAtTime(data, "2026-10-09T20:00", active).high).toEqual([null, 30]);
    expect(getCloudCoverAtTime(data, "2026-10-09T20:00", active)).toEqual([null, 10]);
    expect(getWeatherValuesAtTime(data, "2026-10-09T20:00", active)).toEqual({ precipitation: [null, 1], windSpeed: [null, 3], windDirection: [null, 90] });
    const missingPointHour = point("Asia/Shanghai", 0, [epoch + 3600]);
    expect(resolveCloudGridEpoch(data, "2026-10-09T20:00", null, "Asia/Shanghai", missingPointHour)).toBeNull();
  });
  it("preserves explicit instants and treats missing source samples as unavailable", () => {
    const data = grid([point("Asia/Shanghai", 0), point("Asia/Tokyo", 1, [epoch + 3600, epoch + 7200])]);
    expect(resolveCloudGridEpoch(data, "wrong-wall", epoch, "Asia/Shanghai")).toBe(epoch);
    expect(getValuesAtTime(data, "2026-10-09T20:00", epoch).high).toEqual([0, null]);
  });
  it("uses one epoch rather than equal indices even within a timezone", () => {
    const data = grid([point("Asia/Shanghai", 0), point("Asia/Shanghai", 1, [epoch - 3600, epoch, epoch + 3600])]);
    expect(getValuesAtTime(data, 0).high).toEqual([0, 31]);
    expect(getValuesAtTime(data, 0, epoch).high).toEqual([0, 31]);
  });
  it("selects the exact DST repeat and supports fractional-offset clock labels", () => {
    const first = Date.parse("2026-11-01T08:00:00Z") / 1000;
    const data = grid([point("America/Los_Angeles", 0, [first, first + 3600]), point("UTC", 1, [first, first + 3600])]);
    expect(resolveCloudGridEpoch(data, "2026-11-01T01:00", first + 3600, "America/Los_Angeles")).toBe(first + 3600);
    expect(getValuesAtTime(data, "2026-11-01T01:00", first + 3600).high).toEqual([1, 31]);
    expect(resolveCloudGridEpoch(grid(), "2026-10-09T17:45", null, "Asia/Kathmandu")).toBe(epoch);
  });
  it.each(["model", "coordinates", "axis", "offset", "version", "disjoint"])("still rejects an invalid %s", async kind => {
    const forecasts = [point("Asia/Shanghai", 0), point("Asia/Tokyo", 1)];
    if (kind === "model") forecasts[1].metadata!.model = "icon";
    if (kind === "coordinates") forecasts[1].requestedLatitude = 0;
    if (kind === "axis") forecasts[1].hourly[1].epochSeconds = epoch;
    if (kind === "offset") forecasts[1].hourly[0].utcOffsetSeconds = 0;
    if (kind === "version") Object.assign(forecasts[1].metadata!, { timeAxisVersion: "unknown" });
    if (kind === "disjoint") forecasts[1] = point("Asia/Tokyo", 1, [epoch + 7200, epoch + 10800]);
    vi.mocked(requestForecastResponse).mockResolvedValue({ data: { locations: forecasts }, stale: false });
    await expect(fetchCloudGrid(samples, ["2026-10-09"], 2)).rejects.toThrow();
  });
  it("refuses a legacy grid with matching wall labels but differing timezones", async () => {
    const forecasts = [point("Asia/Shanghai", 0), point("Asia/Shanghai", 1)];
    forecasts[1].timezone = "Asia/Tokyo";
    forecasts.forEach(forecast => {
      delete forecast.metadata!.timeAxisVersion;
      forecast.hourly.forEach(hour => { delete hour.epochSeconds; delete hour.utcOffsetSeconds; });
    });
    vi.mocked(requestForecastResponse).mockResolvedValue({ data: { locations: forecasts }, stale: false });
    await expect(fetchCloudGrid(samples, ["2026-10-09"], 2)).rejects.toThrow();
  });
  it("keeps legacy same-zone display but marks it degraded", async () => {
    const forecasts = [point("Asia/Shanghai", 0), point("Asia/Shanghai", 1)];
    forecasts.forEach(forecast => {
      delete forecast.metadata!.timeAxisVersion;
      forecast.hourly.forEach(hour => { delete hour.epochSeconds; delete hour.utcOffsetSeconds; });
    });
    vi.mocked(requestForecastResponse).mockResolvedValue({ data: { locations: forecasts }, stale: false });
    const data = await fetchCloudGrid(samples, ["2026-10-09"], 2);
    expect(data.stale).toBe(true);
    expect(getValuesAtTime(data, "2026-10-09T20:00").high).toEqual([0, 30]);
  });
});
