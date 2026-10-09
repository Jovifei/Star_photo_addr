import { describe, expect, it } from "vitest";
import { buildGridTimelineHours, buildTrackSegments, nightKeyOfTime } from "@/components/CloudTimeline";
import { normalizeEpochHours } from "@/lib/absoluteForecastTime";
import type { CloudGridData } from "@/lib/types";

function gridAt(epochs: number[]): CloudGridData {
  return {
    model: "icon", samples: [], bounds: { north: 40, south: 30, east: 120, west: 110 }, nightKeys: [], fetchedAt: "2026-10-09T00:00:00Z",
    forecasts: ["Asia/Shanghai", "Asia/Tokyo"].map((timezone, index) => ({
      timezone, locationId: String(index), modelLatitude: 35, modelLongitude: 115, modelElevation: 0, utcOffsetSeconds: index ? 32400 : 28800, fetchedAt: "2026-10-09T00:00:00Z",
      metadata: { source: "Open-Meteo" as const, model: "icon" as const, timeAxisVersion: "epoch-v1" as const, fetchedAt: "2026-10-09T00:00:00Z", stale: false, units: {} },
      hourly: normalizeEpochHours(index ? epochs.slice(1) : epochs, timezone).map(hour => ({ ...hour, cloudCover: index ? 80 : 20 })),
    })),
  };
}

describe("grid timeline clock", () => {
  it("labels all cells in the owning timezone and averages only equal instants", () => {
    const epochs = [Date.parse("2026-10-09T12:00:00Z") / 1000, Date.parse("2026-10-09T13:00:00Z") / 1000];
    const hours = buildGridTimelineHours(gridAt(epochs), "Asia/Shanghai");
    expect(hours.map(hour => hour.time)).toEqual(["2026-10-09T20:00", "2026-10-09T21:00"]);
    expect(hours.map(hour => hour.cloudCover)).toEqual([20, 50]);
    expect(hours.map(hour => hour.epochSeconds)).toEqual(epochs);
    expect(hours[1].utcOffsetSeconds).toBe(28800);
  });

  it("preserves both repeated DST hours and exact click identities", () => {
    const epochs = [Date.parse("2026-11-01T05:00:00Z") / 1000, Date.parse("2026-11-01T06:00:00Z") / 1000];
    const hours = buildGridTimelineHours(gridAt(epochs), "America/New_York");
    expect(hours.map(hour => hour.time)).toEqual(["2026-11-01T01:00", "2026-11-01T01:00"]);
    expect(hours.map(hour => hour.utcOffsetSeconds)).toEqual([-14400, -18000]);
    expect(buildTrackSegments(hours, false)[0].ticks.map(tick => tick.epochSeconds)).toEqual(epochs);
  });

  it("does not borrow the first grid timezone when point timezone is unknown", () => {
    const grid = gridAt([Date.parse("2026-10-09T12:00:00Z") / 1000, Date.parse("2026-10-09T13:00:00Z") / 1000]);
    expect(buildGridTimelineHours(grid)).toEqual([]);
    expect(buildGridTimelineHours(grid, "invalid/timezone")).toEqual([]);
  });

  it("retains absolute identity on daytime ticks", () => {
    expect(buildTrackSegments([{ time: "2026-10-09T12:00", epochSeconds: 1 }], false)[0].ticks[0].epochSeconds).toBe(1);
  });
});

describe("nightKeyOfTime", () => {
  it("rolls post-midnight hours into the previous date", () => {
    expect(nightKeyOfTime("2026-08-22T23:00")).toBe("2026-08-22");
    expect(nightKeyOfTime("2026-08-23T01:00")).toBe("2026-08-22");
    expect(nightKeyOfTime("2026-08-23T05:00")).toBe("2026-08-22");
  });

  it("keeps day and evening hours on their own date", () => {
    expect(nightKeyOfTime("2026-08-22T09:00")).toBe("2026-08-22");
    expect(nightKeyOfTime("2026-08-22T20:00")).toBe("2026-08-22");
  });
});

describe("buildTrackSegments", () => {
  const hours = (date: string, list: number[]) =>
    list.map((hour) => ({ time: `${date}T${String(hour).padStart(2, "0")}:00` }));

  it("groups a 72h forecast into night rails with collapsed day gaps", () => {
    const items = [
      ...hours("2026-08-22", [18, 19, 20, 21, 22, 23]),
      ...hours("2026-08-23", [0, 1, 2, 3, 4, 5, 6, 12, 18, 20, 21, 22, 23]),
      ...hours("2026-08-24", [0, 1, 2, 3, 4, 5]),
    ];
    const segments = buildTrackSegments(items, false);
    const nights = segments.filter((segment) => segment.kind === "night");
    const days = segments.filter((segment) => segment.kind === "day");
    // Night rails span 20:00→05:00: the 8/22 rail owns 8/23's 00–05 hours,
    // and the 8/23 rail owns 8/24's. There is no 8/24 evening in this sample.
    expect(nights.map((segment) => segment.key)).toEqual(["2026-08-22", "2026-08-23"]);
    const nightLabels = ["20", "21", "22", "23", "0", "1", "2", "3", "4", "5"];
    expect(nights[0].ticks.map((tick) => tick.label)).toEqual(nightLabels);
    expect(nights[1].ticks.map((tick) => tick.label)).toEqual(nightLabels);
    // Day gaps keep only 6-hourly probes (18 of 8/22, then 06/12/18 of 8/23).
    expect(days.map((segment) => segment.ticks.map((tick) => tick.label))).toEqual([["18"], ["6", "12", "18"]]);
  });

  it("thins the satellite observation track to at most eight ticks", () => {
    const items = hours("2026-08-22", Array.from({ length: 24 }, (_, index) => index));
    const segments = buildTrackSegments(items, true);
    expect(segments).toHaveLength(1);
    expect(segments[0].ticks.length).toBeLessThanOrEqual(8);
    expect(segments[0].ticks[0].time).toBe("2026-08-22T00:00");
    expect(segments[0].ticks.at(-1)?.time).toBe("2026-08-22T23:00");
  });

  it("returns nothing without data", () => {
    expect(buildTrackSegments([], false)).toEqual([]);
  });
});
