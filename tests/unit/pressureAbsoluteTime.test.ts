import { expect, it } from "vitest";
import { parsePressureForecast, PRESSURE_LEVELS, pressureProfileAt } from "@/lib/pressure";
function raw(iso: string[], timezone = "America/Los_Angeles") {
  const hourly: Record<string, unknown> = { time: iso.map(time => Date.parse(time) / 1000), temperature_2m: [10, 11] };
  for (const level of PRESSURE_LEVELS) {
    hourly[`cloud_cover_${level}hPa`] = [20, 80];
    hourly[`relative_humidity_${level}hPa`] = [70, 90];
    hourly[`temperature_${level}hPa`] = [5, 6];
    hourly[`geopotential_height_${level}hPa`] = [1000, 1100];
  }
  return { elevation: 100, timezone, utc_offset_seconds: -25200, hourly };
}
it("keeps distinct pressure profiles for both repeated LA hours", () => {
  const data = parsePressureForecast(raw(["2026-11-01T08:00Z", "2026-11-01T09:00Z"]), "la", "gfs");
  expect(data.hourly.map(hour => hour.time)).toEqual(["2026-11-01T01:00", "2026-11-01T01:00"]);
  expect(pressureProfileAt(data, "2026-11-01T01:00", Date.parse("2026-11-01T09:00Z") / 1000)?.[0].cloudCover).toBe(80);
  expect(pressureProfileAt(data, "2026-11-01T01:00")?.[0].cloudCover).toBe(20);
  expect(pressureProfileAt(data, "2026-11-01T02:00", Date.parse("2026-11-01T09:00Z") / 1000)).toBeNull();
});
it("does not invent a spring gap and supports quarter-hour timezone", () => {
  const spring = parsePressureForecast(raw(["2026-03-08T09:00Z", "2026-03-08T10:00Z"]), "la", "gfs");
  expect(pressureProfileAt(spring, "2026-03-08T02:00")).toBeNull();
  const ktm = parsePressureForecast(raw(["2026-10-07T12:00Z", "2026-10-07T13:00Z"], "Asia/Kathmandu"), "ktm", "icon");
  expect(ktm.hourly[0].time).toBe("2026-10-07T17:45");
  expect(ktm.hourly[0].utcOffsetSeconds).toBe(20700);
});
it("rejects duplicate epoch, missing zone and fabricated calendar wall time", () => {
  const duplicate = raw(["2026-11-01T08:00Z", "2026-11-01T08:00Z"]);
  expect(() => parsePressureForecast(duplicate, "la", "gfs")).toThrow();
  expect(() => parsePressureForecast({ ...duplicate, timezone: undefined }, "la", "gfs")).toThrow();
  expect(() => parsePressureForecast({ ...duplicate, hourly: { ...duplicate.hourly, time: ["2026-02-30T01:00", "2026-02-30T02:00"] } }, "la", "gfs")).toThrow();
});
