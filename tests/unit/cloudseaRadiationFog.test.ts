import { describe, expect, it } from "vitest";
import { evaluateCloudSeaWindow } from "@/lib/cloudsea";
import { PRESSURE_LEVELS, type PressureForecastResponse, type PressureLevelSample } from "@/lib/pressure";
import type { CloudSeaSite } from "@/lib/cloudseaSites";

const time = "2026-09-02T06:00";
const site: CloudSeaSite = {
  id: "mountain-summit",
  name: "Mount Observation",
  latitude: 35.59,
  longitude: -83.07,
  altitude: 1500, // Summit at 1500m
  area: "Valley Mountain",
  province: "Test",
  viewpoint: "Tower",
  description: "Test viewpoint",
};

// Realistic temperature profile with inversion between 750m and 1250m:
// valley floor 750m: 14°C
// inversion top 1100m: 17°C (warmer aloft!)
// summit 1500m: 15°C
function radiationFogProfile(): PressureLevelSample[] {
  return [
    { pressure: 1000, heightMsl: 100, cloudCover: 5, humidity: 88, temperature: 18 },
    { pressure: 975, heightMsl: 300, cloudCover: 5, humidity: 85, temperature: 17 },
    { pressure: 950, heightMsl: 500, cloudCover: 5, humidity: 82, temperature: 15 },
    { pressure: 925, heightMsl: 750, cloudCover: 5, humidity: 80, temperature: 14 }, // valley floor base
    { pressure: 900, heightMsl: 1000, cloudCover: 10, humidity: 75, temperature: 16.5 }, // inversion warm nose
    { pressure: 875, heightMsl: 1250, cloudCover: 5, humidity: 65, temperature: 16 },
    { pressure: 850, heightMsl: 1500, cloudCover: 0, humidity: 55, temperature: 15 }, // summit level: dry & clear
    { pressure: 800, heightMsl: 2000, cloudCover: 0, humidity: 40, temperature: 11 },
    { pressure: 700, heightMsl: 3000, cloudCover: 0, humidity: 30, temperature: 4 },
    { pressure: 600, heightMsl: 4200, cloudCover: 0, humidity: 20, temperature: -4 },
    { pressure: 500, heightMsl: 5600, cloudCover: 0, humidity: 15, temperature: -12 },
  ];
}

function evaluateWindow(
  profile: PressureLevelSample[],
  options: {
    lowCloud?: number;
    midCloud?: number;
    highCloud?: number;
    rh?: number;
    wind?: number;
    precip?: number;
    native?: boolean;
  } = {},
) {
  const fetchedAt = new Date().toISOString();
  const pressure: PressureForecastResponse = {
    locationId: site.id,
    modelElevation: 750, // Model valley floor is 750m
    ...(options.native === false
      ? {}
      : {
          nativeGridElevationM: 750,
          verticalReference: "native-grid-v2" as const,
        }),
    qualifiedPressureLevels: PRESSURE_LEVELS,
    timezone: "UTC",
    utcOffsetSeconds: 0,
    fetchedAt,
    source: "Open-Meteo",
    model: "gfs",
    stale: false,
    qualitySchema: "pressure-provider-issues-v1",
    qualityValidatorVersion: "pressure-validator-v1",
    qualityValidatedAt: fetchedAt,
    hourly: [{ time, temperature: 15 }],
    profiles: { [time]: profile },
  };

  return evaluateCloudSeaWindow(
    site,
    {
      time: [time],
      cloud_cover_low: [options.lowCloud ?? 0],
      cloud_cover_mid: [options.midCloud ?? 5],
      cloud_cover_high: [options.highCloud ?? 10],
      relative_humidity_2m: [options.rh ?? 85],
      wind_speed_10m: [options.wind ?? 1.2],
      precipitation: [options.precip ?? 0],
    },
    [6],
    pressure,
    "2026-09-02",
  );
}

describe("CloudSea radiation valley fog calibration", () => {
  it("detects radiation valley fog when GFS low cloud is 0% but radiative cooling, calm wind, humidity and valley inversion exist", () => {
    const result = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0,
      midCloud: 5,
      highCloud: 10,
      rh: 85,
      wind: 1.2,
      precip: 0,
    });

    expect(result.cloudPosition).toBe("above");
    expect(result.score).toBeGreaterThanOrEqual(60);
    expect(result.score).toBeLessThanOrEqual(85);
    expect(result.altitudeDiffM).toBeGreaterThanOrEqual(100);
    expect(result.summary).toContain("辐射谷雾");
  });

  it("refuses radiation fog high score without proven native grid reference", () => {
    const nonNative = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0,
      midCloud: 5,
      highCloud: 10,
      rh: 85,
      wind: 1.2,
      native: false,
    });

    expect(nonNative.score ?? 0).toBeLessThan(25);
  });

  it("refuses high radiation fog score when upper clouds obstruct radiative cooling", () => {
    const overcastAloft = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0,
      midCloud: 65,
      highCloud: 80,
      rh: 85,
      wind: 1.2,
    });

    expect(overcastAloft.score ?? 0).toBeLessThan(40);
  });

  it("refuses high radiation fog score when wind speed is strong (>2.5 m/s)", () => {
    const windy = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0,
      midCloud: 5,
      highCloud: 10,
      rh: 85,
      wind: 4.8,
    });

    expect(windy.score ?? 0).toBeLessThan(40);
  });

  it("refuses radiation fog when rain is occurring", () => {
    const rainy = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0,
      midCloud: 5,
      highCloud: 10,
      rh: 95,
      wind: 1.2,
      precip: 1.5,
    });

    expect(rainy.score ?? 0).toBeLessThan(40);
  });

  it("refuses radiation fog when near-surface air is too dry (RH < 70%)", () => {
    const dry = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0,
      midCloud: 5,
      highCloud: 10,
      rh: 50,
      wind: 1.2,
    });

    expect(dry.score ?? 0).toBeLessThan(25);
  });
});

// Regression (2026-11-07 review): the radiation-fog branch published
// topUpperM = topM + 100 but computed altitudeDiffM against topM, overstating
// the clearance by exactly the 100 m bound width; and its entry gate allowed
// an inversion top up to 150 m ABOVE the summit, so a summit below the
// branch's own cloud-top upper bound could still be labelled 云上.
describe("CloudSea radiation fog clearance consistency", () => {
  it("measures clearance against the cloud-top upper bound, not the nominal top", () => {
    const result = evaluateWindow(radiationFogProfile(), {
      lowCloud: 0, midCloud: 5, highCloud: 10, rh: 85, wind: 1.2, precip: 0,
    });
    expect(result.cloudPosition).toBe("above");
    expect(result.cloudTopUpperM).toBe((result.cloudTopM ?? 0) + 100);
    expect(result.altitudeDiffM).toBe(site.altitude - (result.cloudTopUpperM ?? 0));
  });

  it("does not claim 云上 when the summit is below the fog-top upper bound", () => {
    // A gradual inversion: temperature bottoms at 1000 m (13°) and only
    // warms decisively by 1450 m (15.2°), so the detected inversion top —
    // and thus the fog top — sits at ≈1450 m with an upper bound of
    // ≈1550 m: above the 1500 m summit, which therefore sits inside the
    // uncertainty band and must not be labelled above the cloud.
    const highInversion: PressureLevelSample[] = [
      { pressure: 1000, heightMsl: 100, cloudCover: 5, humidity: 88, temperature: 18 },
      { pressure: 975, heightMsl: 300, cloudCover: 5, humidity: 85, temperature: 17 },
      { pressure: 950, heightMsl: 500, cloudCover: 5, humidity: 82, temperature: 15.5 },
      { pressure: 925, heightMsl: 750, cloudCover: 5, humidity: 80, temperature: 14 },
      { pressure: 900, heightMsl: 1000, cloudCover: 8, humidity: 78, temperature: 13 },
      { pressure: 875, heightMsl: 1200, cloudCover: 5, humidity: 76, temperature: 13.9 },
      { pressure: 850, heightMsl: 1450, cloudCover: 0, humidity: 74, temperature: 15.2 },
      { pressure: 825, heightMsl: 1700, cloudCover: 0, humidity: 55, temperature: 10 },
      { pressure: 800, heightMsl: 2000, cloudCover: 0, humidity: 40, temperature: 8 },
      { pressure: 700, heightMsl: 3000, cloudCover: 0, humidity: 30, temperature: 2 },
      { pressure: 600, heightMsl: 4200, cloudCover: 0, humidity: 20, temperature: -6 },
      { pressure: 500, heightMsl: 5600, cloudCover: 0, humidity: 15, temperature: -14 },
    ];
    const result = evaluateWindow(highInversion, {
      lowCloud: 0, midCloud: 5, highCloud: 10, rh: 85, wind: 1.2, precip: 0,
    });
    expect(result.cloudPosition).not.toBe("above");
  });
});
