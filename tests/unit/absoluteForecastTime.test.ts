import { expect, it } from "vitest";
import { normalizeEpochHours, resolveWallHour, validAbsoluteHours } from "@/lib/absoluteForecastTime";
it("does not add utc_offset_seconds to Open-Meteo hourly UNIX epochs", () => {
  const hours = normalizeEpochHours([Date.parse("2026-10-07T12:00:00Z") / 1000], "Asia/Kathmandu");
  expect(hours[0].time).toBe("2026-10-07T17:45");
  expect(hours[0].utcOffsetSeconds).toBe(20700);
});
it("keeps both LA fall-back hours as distinct instants and makes old URL selection choose the earlier occurrence", () => {
  const epochs = ["2026-11-01T08:00:00Z", "2026-11-01T09:00:00Z", "2026-11-01T10:00:00Z"].map(time => Date.parse(time) / 1000);
  const hours = normalizeEpochHours(epochs, "America/Los_Angeles");
  expect(hours.map(hour => hour.time)).toEqual(["2026-11-01T01:00", "2026-11-01T01:00", "2026-11-01T02:00"]);
  expect(validAbsoluteHours(hours)).toBe(true);
  expect(resolveWallHour(hours, "2026-11-01T01:00")?.epochSeconds).toBe(epochs[0]);
  expect(resolveWallHour(hours, "2026-11-01T01:00", epochs[1])?.epochSeconds).toBe(epochs[1]);
});
it("does not invent nonexistent spring-forward hours", () => {
  const hours = normalizeEpochHours([Date.parse("2026-03-08T09:00:00Z") / 1000, Date.parse("2026-03-08T10:00:00Z") / 1000], "America/Los_Angeles");
  expect(hours.map(hour => hour.time)).toEqual(["2026-03-08T01:00", "2026-03-08T03:00"]);
  expect(resolveWallHour(hours, "2026-03-08T02:00")).toBeNull();
});
it("rejects duplicate and descending absolute instants", () => {
  expect(() => normalizeEpochHours([1,1], "UTC")).toThrow();
  expect(() => normalizeEpochHours([2,1], "UTC")).toThrow();
});
