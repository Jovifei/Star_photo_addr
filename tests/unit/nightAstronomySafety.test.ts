import { describe, expect, it } from "vitest";
import { scoreCoreWeather } from "@/lib/forecastIntegrity";
import { scoreHour } from "@/lib/hourScore";
import { scoreObservingSiteAtTime } from "@/lib/observingSites";
import { evaluateNight } from "@/lib/scoring";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";
import type { HourWeather, Location, LocationForecast, ObservingSite } from "@/lib/types";

const LOCATION: Location = {
  id: "astronomy-safety", name: "天文评分边界", latitude: 30, longitude: 120,
  elevation: 100, source: "自定义",
};
const SITE: ObservingSite = {
  id: LOCATION.id, name: LOCATION.name, latitude: LOCATION.latitude,
  longitude: LOCATION.longitude, altitude: LOCATION.elevation,
  province: "浙江", area: "测试", bortle: 2,
};

function clearHour(time: string): HourWeather {
  return {
    time, temperature: 15, humidity: 60, dewPoint: 8,
    precipitationProbability: 0, precipitation: 0, weatherCode: 0,
    cloudCover: 0, cloudLow: 0, cloudMid: 0, cloudHigh: 0,
    visibility: 30_000, windSpeed: 1, windGust: 2,
  };
}

function clearRecord(time: string): FinderWeatherRecord {
  return {
    status: "available", fetchedAt: new Date().toISOString(), model: "gfs",
    timezone: "Asia/Shanghai", utcOffsetSeconds: 28_800,
    hourly: {
      time: [time], temperature_2m: [15], relative_humidity_2m: [60],
      dew_point_2m: [8], precipitation_probability: [0], precipitation: [0],
      weather_code: [0], cloud_cover: [0], cloud_cover_low: [0],
      cloud_cover_mid: [0], cloud_cover_high: [0], visibility: [30_000],
      wind_speed_10m: [1], wind_gusts_10m: [2],
    },
  };
}

function clearNight(): LocationForecast {
  const fetchedAt = new Date().toISOString();
  return {
    locationId: LOCATION.id, requestedLatitude: LOCATION.latitude,
    requestedLongitude: LOCATION.longitude, modelLatitude: LOCATION.latitude,
    modelLongitude: LOCATION.longitude, modelElevation: 100,
    timezone: "Asia/Shanghai", utcOffsetSeconds: 28_800, fetchedAt,
    metadata: { source: "Open-Meteo", model: "gfs", fetchedAt, stale: false, units: {} },
    hourly: Array.from({ length: 10 }, (_, index) => clearHour(index < 4
      ? `2026-08-12T${20 + index}:00`
      : `2026-08-13T0${index - 4}:00`)),
  };
}

describe("astronomical darkness is required for a stargazing recommendation", () => {
  it.each([
    ["daylight", "2026-10-24T12:00", 40],
    ["bright twilight", "2026-10-24T18:00", 40],
    ["astronomical twilight", "2026-10-24T18:30", 70],
  ])("blocks %s even with ideal weather, without changing the weather evidence", (_, time, maximum) => {
    const input = clearHour(time);
    expect(scoreCoreWeather(input)?.weatherScore).toBe(100);
    const result = scoreHour(input, LOCATION, 28_800)!;
    expect(result.sunAltitude).toBeGreaterThan(-18);
    expect(result.score).toBeLessThan(maximum);
    expect(result.quality).toBe("blocked");
    expect(result.blockers.join("；")).toContain("天文暗夜");
    expect(result.components.clearSky).toBe(100);
    expect(result.components.precipitation).toBe(100);
    expect(result.cloudCover).toBe(0);
    expect(scoreCoreWeather(input)?.weatherScore).toBe(100);
  });

  it("does not publish a daytime map point as a recommended stargazing site", () => {
    const time = "2026-10-24T12:00";
    const result = scoreObservingSiteAtTime(SITE, clearRecord(time), time, "gfs");
    expect(result.score).toBeLessThan(70);
    expect(result.band).toBe("not-recommended");
    expect(result.blockers.join("；")).toContain("天文暗夜");
    expect(result.darkness).toBe(0);
    expect(result.cloud).toBe(0);
    expect(result.weatherRisk).toBe(100);
  });

  it("retains the existing full-dark, moon-below-horizon baseline", () => {
    const result = scoreHour(clearHour("2026-08-12T00:00"), LOCATION, 28_800)!;
    expect(result.sunAltitude).toBeLessThan(-18);
    expect(result.moonAltitude).toBeLessThan(-5);
    expect(result.score).toBe(100);
    expect(result.quality).toBe("excellent");
    expect(result.blockers).toEqual([]);
  });

  it("withholds the whole night instead of throwing for invalid observer input", () => {
    for (const invalid of [{ latitude: 91 }, { latitude: NaN }, { elevation: NaN }]) {
      expect(evaluateNight(clearNight(), { ...LOCATION, ...invalid }, "2026-08-12")).toBeNull();
    }
  });

  it("does not let twilight outside the chosen dark window veto a complete dark-night window", () => {
    const result = evaluateNight(clearNight(), LOCATION, "2026-08-12")!;
    expect(result.hours.some(hour => hour.sunAltitude > -18)).toBe(true);
    expect(result.window).toHaveLength(3);
    expect(result.window.every(hour => hour.sunAltitude <= -18)).toBe(true);
    expect(result.status).toBe("go");
    expect(result.blockers).toEqual([]);
  });

  it("continues to report weather hazards outside the chosen dark window", () => {
    const forecast = clearNight();
    forecast.hourly[0]!.precipitation = 1;
    const result = evaluateNight(forecast, LOCATION, "2026-08-12")!;
    expect(result.window).toHaveLength(3);
    expect(result.blockers).toContain("降水风险");
    expect(result.status).toBe("no");
  });
});
