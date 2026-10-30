import { describe, expect, it } from "vitest";
import { evaluateCloudSeaWindow } from "@/lib/cloudsea";
import type { CloudSeaSite } from "@/lib/cloudseaSites";
import {
  PRESSURE_LEVELS,
  type PressureForecastResponse,
  type PressureLevelSample,
} from "@/lib/pressure";
import { PRESSURE_PROVIDER_VALIDATOR_VERSION } from "@/lib/pressureProviderIntegrity";

const site: CloudSeaSite = {
  id: "integrity-summit",
  name: "Integrity Summit",
  latitude: 30.1,
  longitude: 119.2,
  altitude: 1500,
  area: "test",
  province: "test",
  viewpoint: "test",
  description: "test",
};

function sample(
  pressure: number,
  heightMsl: number,
  cloudy: boolean,
): PressureLevelSample {
  return {
    pressure,
    heightMsl,
    cloudCover: cloudy ? 85 : 5,
    humidity: cloudy ? 96 : 55,
    temperature: 10 - heightMsl * 0.006,
  };
}

const cleanProfile = [
  sample(1000, 100, false),
  sample(975, 300, false),
  sample(950, 500, true),
  sample(925, 750, true),
  sample(900, 1000, false),
  sample(850, 1500, false),
  sample(800, 2000, false),
  sample(750, 2500, false),
  sample(700, 3000, false),
  sample(600, 4200, false),
  sample(500, 5500, false),
];

function pollutedProfile(
  lowerCloudy = true,
  upperCloudy = true,
): PressureLevelSample[] {
  return cleanProfile.map((level) => {
    if (level.pressure === 850) {
      return {
        ...level,
        providerIssues: [{
          field: "cloud_cover_850hPa",
          rawValue: 101,
          reason: "out-of-range" as const,
        }],
        cloudCover: null,
      };
    }
    if (level.pressure === 925) return { ...level, cloudCover: lowerCloudy ? 85 : 5 };
    if (level.pressure === 800) return { ...level, cloudCover: upperCloudy ? 85 : 5 };
    return level;
  });
}

function pressureFor(
  times: string[],
  profiles: PressureLevelSample[],
): PressureForecastResponse {
  return {
    locationId: site.id,
    modelElevation: 100,
    nativeGridElevationM: 100,
    verticalReference: "native-grid-v2",
    qualifiedPressureLevels: PRESSURE_LEVELS,
    timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28800,
    fetchedAt: "2026-10-30T00:00:00Z",
    source: "Open-Meteo",
    model: "gfs",
    stale: false,
    qualitySchema: "pressure-provider-issues-v1",
    qualityValidatorVersion: "pressure-validator-v1",
    qualityValidatedAt: "2026-10-30T00:00:00Z",
    hourly: times.map((time) => ({ time, temperature: 10 })),
    profiles: Object.fromEntries(times.map((time) => [time, profiles])),
  };
}

function hourly(times: string[], lowCloud = 90) {
  return {
    time: times,
    cloud_cover_low: times.map(() => lowCloud),
    cloud_cover_mid: times.map(() => 5),
    cloud_cover_high: times.map(() => 5),
    relative_humidity_2m: times.map(() => 96),
    wind_speed_10m: times.map(() => 2),
    precipitation: times.map(() => 0),
  };
}

describe("cloud-sea pressure provider integrity", () => {
  it("fails a polluted hour before the low-cloud clear shortcut", () => {
    const times = ["2026-10-30T05:00"];
    const result = evaluateCloudSeaWindow(
      site,
      hourly(times, 0),
      [5],
      pressureFor(times, pollutedProfile(false, false)),
      "2026-10-30",
    );

    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.pressureStatus).toBe("unavailable");
    expect(result.summary).toMatch(/压力层.*非法|非法.*压力层/);
  });

  it.each([
    ["cloud-unknown-cloud", true, true],
    ["cloud-unknown-clear", true, false],
  ])("never crosses an unknown layer in %s", (_label, lowerCloudy, upperCloudy) => {
    const times = ["2026-10-30T05:00"];
    const result = evaluateCloudSeaWindow(
      lowerCloudy && upperCloudy ? { ...site, altitude: 3000 } : site,
      hourly(times),
      [5],
      pressureFor(times, pollutedProfile(lowerCloudy, upperCloudy)),
      "2026-10-30",
    );

    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.cloudTopUpperM).toBeNull();
    expect(result.pressureConfidence).toBeNull();
  });

  it("keeps complete clean hours unchanged", () => {
    const times = ["2026-10-30T05:00"];
    const result = evaluateCloudSeaWindow(
      site,
      hourly(times),
      [5],
      pressureFor(times, cleanProfile),
      "2026-10-30",
    );

    expect(result.score).not.toBeNull();
    expect(result.cloudPosition).toBe("above");
    expect(result.coverage).toEqual({
      expectedHours: 1,
      surfaceValidHours: 1,
      scoreableHours: 1,
      pressureHours: 1,
    });
  });

  it("does not publish inversion evidence across a polluted pressure level", () => {
    const times = ["2026-10-30T05:00"];
    const profile = pollutedProfile();
    profile.find((level) => level.pressure === 925)!.temperature = 2;
    profile.find((level) => level.pressure === 850)!.temperature = 10;
    profile.find((level) => level.pressure === 800)!.temperature = 4;

    const result = evaluateCloudSeaWindow(
      site,
      hourly(times),
      [5],
      pressureFor(times, profile),
      "2026-10-30",
    );

    expect(result.score).toBeNull();
    expect(result.inversion.status).toBe("unavailable");
  });

  it("does not newly score a legacy response that lacks the quality schema", () => {
    const times = ["2026-10-30T05:00"];
    const pressure = pressureFor(times, cleanProfile);
    delete (pressure as Partial<PressureForecastResponse>).qualitySchema;

    const result = evaluateCloudSeaWindow(
      site,
      hourly(times),
      [5],
      pressure,
      "2026-10-30",
    );

    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.summary).toMatch(/质量.*schema|schema.*质量/);
  });

  it("does not newly score a schema-bearing response without validation provenance", () => {
    const times = ["2026-10-30T05:00"];
    const pressure = pressureFor(times, cleanProfile);
    delete (pressure as Partial<PressureForecastResponse>).qualityValidatorVersion;
    delete (pressure as Partial<PressureForecastResponse>).qualityValidatedAt;

    const result = evaluateCloudSeaWindow(
      site,
      hourly(times),
      [5],
      pressure,
      "2026-10-30",
    );

    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.summary).toMatch(/校验来源|质量/);
  });

  it("does not newly score a mismatched pressure validator version", () => {
    const times = ["2026-10-30T05:00"];
    const pressure = pressureFor(times, cleanProfile);
    pressure.qualityValidatorVersion =
      "forged-validator" as typeof PRESSURE_PROVIDER_VALIDATOR_VERSION;

    const result = evaluateCloudSeaWindow(
      site,
      hourly(times),
      [5],
      pressure,
      "2026-10-30",
    );

    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.summary).toMatch(/校验来源|质量/);
  });

  it("retains the quality schema and provider issues through JSON round trips", () => {
    const times = ["2026-10-30T05:00"];
    const roundTripped = JSON.parse(JSON.stringify(
      pressureFor(times, pollutedProfile()),
    )) as PressureForecastResponse;

    expect(roundTripped.qualitySchema).toBe("pressure-provider-issues-v1");
    expect(
      roundTripped.profiles[times[0]!]!.find((level) => level.pressure === 850)
        ?.providerIssues,
    ).toEqual([{
      field: "cloud_cover_850hPa",
      rawValue: 101,
      reason: "out-of-range",
    }]);
  });

  it.each([
    { expected: 3, clean: 1, publish: false },
    { expected: 3, clean: 2, publish: true },
    { expected: 4, clean: 2, publish: false },
    { expected: 4, clean: 3, publish: true },
  ])(
    "keeps the strict-majority denominator for $clean/$expected clean hours",
    ({ expected, clean, publish }) => {
      const times = Array.from(
        { length: expected },
        (_, index) => `2026-10-30T${String(5 + index).padStart(2, "0")}:00`,
      );
      const pressure = pressureFor(times, cleanProfile);
      times.forEach((time, index) => {
        if (index >= clean) pressure.profiles[time] = pollutedProfile();
      });

      const result = evaluateCloudSeaWindow(
        site,
        hourly(times),
        times.map((time) => Number(time.slice(11, 13))),
        pressure,
        "2026-10-30",
      );

      expect(result.score === null).toBe(!publish);
      expect(result.coverage).toEqual({
        expectedHours: expected,
        surfaceValidHours: expected,
        scoreableHours: clean,
        pressureHours: clean,
      });
      expect(result.peakScore).toEqual(expect.any(Number));
      expect(result.peakTime).toBe(times[0]!.slice(11, 16));
      expect(result.summary.includes("必须超过半数")).toBe(!publish);
    },
  );
});
