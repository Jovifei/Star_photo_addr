import { describe, expect, it } from "vitest";
import { buildTrackSegments, nightKeyOfTime } from "@/components/CloudTimeline";

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
