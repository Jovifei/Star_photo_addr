import { describe, expect, it } from "vitest";
import {
  conditionLevelFor,
  deriveCloudSeaVerticalEvidence,
  evaluateCloudSeaWindow,
  positionBadgeTone,
} from "@/lib/cloudsea";
import {
  interpolateScoreGrid,
  levelIndexFor,
} from "@/lib/cloudseaOverlay";
import type { CloudSeaSite } from "@/lib/cloudseaSites";
import {
  PRESSURE_LEVELS,
  type PressureForecastResponse,
  type PressureLevelSample,
} from "@/lib/pressure";

const MOCK_HIGH_SITE: CloudSeaSite = {
  id: "test-niubei",
  name: "牛背山",
  province: "四川",
  area: "雅安",
  latitude: 29.74,
  longitude: 102.32,
  altitude: 3660,
  viewpoint: "观景平台",
  description: "测试高山点位",
};

const MOCK_LOW_SITE: CloudSeaSite = {
  id: "test-low",
  name: "平原低地",
  province: "江苏",
  area: "南京",
  latitude: 32.0,
  longitude: 118.8,
  altitude: 200,
  viewpoint: "平原",
  description: "测试低海拔点位",
};

const HEIGHTS: Record<number, number> = {
  1000: 100,
  975: 300,
  950: 500,
  925: 750,
  900: 1000,
  875: 1250,
  850: 1500,
  825: 1750,
  800: 2000,
  775: 2250,
  750: 2500,
  725: 2750,
  700: 3000,
  650: 3500,
  600: 4200,
  550: 4900,
  500: 5600,
};

function profileSamples(
  mode: "low-deck" | "high-only" = "low-deck",
  inversion = true,
): PressureLevelSample[] {
  return PRESSURE_LEVELS.map((pressure, index) => {
    const lowDeck = [950, 925, 900].includes(pressure);
    const highDeck = [600, 500].includes(pressure);
    const cloudy = mode === "low-deck" ? lowDeck : highDeck;
    const temperature = inversion
      ? pressure === 950
        ? 8
        : pressure === 925
          ? 10.2
          : 12 - (1000 - pressure) * 0.012
      : 12 - index * 1.5;
    return {
      pressure,
      cloudCover: cloudy ? 82 : 10,
      humidity: cloudy ? 92 : 55,
      temperature,
      heightMsl: HEIGHTS[pressure] ?? null,
    };
  });
}

function sparseProfile(completeLevels: number): PressureLevelSample[] {
  return profileSamples().map((sample, index) =>
    index < completeLevels
      ? sample
      : {
          ...sample,
          cloudCover: null,
          humidity: null,
          temperature: null,
          heightMsl: null,
        },
  );
}

function pressureFor(
  siteId: string,
  times: string[],
  mode: "low-deck" | "high-only" = "low-deck",
  modelElevation = 400,
  inversion = true,
): PressureForecastResponse {
  return {
    locationId: siteId,
    modelElevation,
    nativeGridElevationM: modelElevation,
    verticalReference: "native-grid-v2",
    qualifiedPressureLevels: PRESSURE_LEVELS,
    timezone: "Asia/Shanghai",
    utcOffsetSeconds: 28800,
    fetchedAt: "2026-09-04T00:00:00.000Z",
    source: "Open-Meteo",
    model: "icon",
    stale: false,
    qualitySchema: "pressure-provider-issues-v1",
    qualityValidatorVersion: "pressure-validator-v1",
    qualityValidatedAt: "2026-09-04T00:00:00.000Z",
    hourly: times.map((time) => ({ time, temperature: 10 })),
    profiles: Object.fromEntries(
      times.map((time) => [time, profileSamples(mode, inversion)]),
    ),
  };
}

function hourlyFixture(overrides: Record<string, Array<number | null>> = {}) {
  const time = [
    "2026-09-04T05:00",
    "2026-09-04T06:00",
    "2026-09-04T07:00",
    "2026-09-04T08:00",
  ];
  return {
    time,
    cloud_cover_low: [80, 85, 80, 75],
    cloud_cover_mid: [5, 10, 5, 5],
    cloud_cover_high: [10, 10, 15, 10],
    temperature_2m: [8, 8, 9, 11],
    wind_speed_10m: [1.8, 1.5, 2.0, 2.2],
    relative_humidity_2m: [88, 90, 89, 86],
    precipitation: [0, 0, 0, 0],
    ...overrides,
  };
}

describe("pressure-derived cloud-sea vertical evidence", () => {
  it("selects a lower-troposphere cloud deck and detects inversion evidence", () => {
    const evidence = deriveCloudSeaVerticalEvidence(
      profileSamples(),
      400,
      MOCK_HIGH_SITE.altitude,
    );
    expect(evidence.profileAvailable).toBe(true);
    expect(evidence.layer?.baseMsl).toBe(500);
    expect(evidence.layer?.topMsl).toBe(1000);
    expect(evidence.layer?.relation).toBe("云上");
    expect(evidence.inversion.status).toBe("detected");
  });

  it("does not treat a sparse hour with fewer than six complete levels as pressure-available", () => {
    const evidence = deriveCloudSeaVerticalEvidence(
      sparseProfile(5),
      400,
      MOCK_HIGH_SITE.altitude,
    );
    expect(evidence.profileAvailable).toBe(false);
    expect(evidence.layer).toBeNull();
    expect(evidence.inversion.status).toBe("unavailable");
  });

  it("does not treat high-only 600/500 hPa cloud as valley cloud sea", () => {
    const evidence = deriveCloudSeaVerticalEvidence(
      profileSamples("high-only"),
      400,
      MOCK_HIGH_SITE.altitude,
    );
    expect(evidence.profileAvailable).toBe(true);
    expect(evidence.layer).toBeNull();
  });
});

describe("evaluateCloudSeaWindow", () => {
  it("does not count repeated source hours as additional window coverage", () => {
    const hourly = { ...hourlyFixture(), time: Array(4).fill("2026-09-04T05:00") as string[] };
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE, hourly, [5, 6, 7, 8], pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.score).toBeNull();
    expect(result.coverage?.surfaceValidHours).toBe(1);
    expect(result.coverage?.expectedHours).toBe(4);
  });

  it("does not call a summit above the clouds when a second deck encloses it", () => {
    const hourly = hourlyFixture();
    const pressure = pressureFor(MOCK_HIGH_SITE.id, hourly.time);
    for (const samples of Object.values(pressure.profiles)) {
      for (const sample of samples) {
        if (sample.pressure <= 800 && sample.pressure >= 700) {
          sample.cloudCover = 90;
          sample.humidity = 95;
        }
      }
    }
    const result = evaluateCloudSeaWindow(
      { ...MOCK_HIGH_SITE, altitude: 2200 }, hourly, [5, 6, 7, 8], pressure,
    );
    expect(result.cloudPosition).toBe("in");
    expect(result.score).toBeLessThanOrEqual(35);
    expect(result.cloudBaseM).toBe(2000);
    expect(result.cloudTopM).toBe(3000);
  });

  it("retains cloud-envelopment evidence even if surface low-cloud cover is small", () => {
    const hourly = hourlyFixture({ cloud_cover_low: [10, 10, 10, 10] });
    const result = evaluateCloudSeaWindow(
      { ...MOCK_HIGH_SITE, altitude: 750 }, hourly, [5, 6, 7, 8],
      pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.cloudPosition).toBe("in");
    expect(result.cloudBaseM).toBe(500);
    expect(result.cloudTopM).toBe(1000);
    expect(result.score).toBeLessThanOrEqual(35);
  });

  it("keeps a brief excellent hour separate from the window mean", () => {
    const hourly = hourlyFixture({ cloud_cover_low: [90, 0, 0, 0] });
    const pressure = pressureFor(MOCK_HIGH_SITE.id, hourly.time);
    for (const time of hourly.time.slice(1)) pressure.profiles[time] = profileSamples().map(sample => ({...sample,cloudCover:0,humidity:55}));
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE, hourly, [5, 6, 7, 8], pressure,
    );
    expect(result.score).toBeLessThan(40);
    expect(result.peakScore).toBeGreaterThan(90);
    expect(result.peakTime).toBe("05:00");
    expect(result.coverage).toEqual({
      expectedHours: 4, surfaceValidHours: 4, scoreableHours: 4, pressureHours: 4,
    });
  });

  it("withholds a four-hour mean when only one hour is valid, retaining that hour's evidence", () => {
    const hourly = hourlyFixture({ cloud_cover_low: [90, null, null, null] });
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE, hourly, [5, 6, 7, 8], pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.score).toBeNull();
    expect(result.conditionLabel).toBeNull();
    expect(result.peakScore).toBeGreaterThan(90);
    expect(result.peakTime).toBe("05:00");
    expect(result.cloudPosition).toBe("above");
    expect(result.coverage).toEqual({
      expectedHours: 4, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 1,
    });
  });

  it("counts distinct target hours and publishes a majority without inventing the missing hour", () => {
    const hourly = hourlyFixture({ cloud_cover_low: [90, 85, 80, null] });
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE, hourly, [5, 5, 6, 7, 8], pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.score).not.toBeNull();
    expect(result.coverage).toEqual({
      expectedHours: 4, surfaceValidHours: 3, scoreableHours: 3, pressureHours: 3,
    });
  });

  it("reports zero scoreable hours rather than a peak when the pressure profile is unavailable", () => {
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourlyFixture(), [5, 6, 7, 8]);
    expect(result.score).toBeNull();
    expect(result.peakScore).toBeNull();
    expect(result.peakTime).toBeNull();
    expect(result.coverage).toEqual({
      expectedHours: 4, surfaceValidHours: 4, scoreableHours: 0, pressureHours: 0,
    });
  });

  it("reports expected coverage even when the forecast has no target hours", () => {
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, { time: [] }, [5, 6, 7, 8]);
    expect(result.peakScore).toBeNull();
    expect(result.coverage).toEqual({
      expectedHours: 4, surfaceValidHours: 0, scoreableHours: 0, pressureHours: 0,
    });
  });

  it("can publish an explicitly requested single hour without changing legacy score aliases", () => {
    const hourly = hourlyFixture();
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE, hourly, [5], pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.score).not.toBeNull();
    expect(result.score).toBe(result.peakScore);
    expect(result.probabilityLabel).toBe(result.conditionLabel);
    expect(result.probabilityLevel).toBe(result.conditionLevel);
    expect(result.coverage).toEqual({
      expectedHours: 1, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 1,
    });
  });

  it("identifies a high summit above a pressure-derived low cloud deck", () => {
    const hourly = hourlyFixture();
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.cloudPosition).toBe("above");
    expect(result.positionLabel).toBe("山顶在云层上方");
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.conditionLabel).toMatch(/\/100$/);
    expect(result.probabilityLabel).toBe(result.conditionLabel);
    expect(result.cloudBaseM).toBe(500);
    expect(result.cloudTopM).toBe(1000);
    expect(result.cloudTopUpperM).toBe(1250);
    expect(result.altitudeDiffM).toBe(2410);
    expect(result.pressureStatus).toBe("available");
    expect(result.inversion.status).toBe("detected");
  });

  it("withholds a low site inside the unresolved cloud-base transition", () => {
    const hourly = hourlyFixture({
      cloud_cover_low: [80, 80, 85, 80],
      cloud_cover_mid: [50, 50, 60, 50],
      cloud_cover_high: [30, 30, 40, 30],
      temperature_2m: [18, 18, 19, 19],
      wind_speed_10m: [3.5, 4.0, 3.8, 3.7],
      relative_humidity_2m: [82, 80, 84, 82],
    });
    const result = evaluateCloudSeaWindow(
      MOCK_LOW_SITE,
      hourly,
      [5, 6, 7, 8],
      pressureFor(MOCK_LOW_SITE.id, hourly.time, "low-deck", 50),
    );
    expect(result.cloudPosition).toBe("unknown");
    expect(result.score).toBeNull();
  });

  it("fails closed instead of inventing cloud base/top when pressure is unavailable", () => {
    const hourly = hourlyFixture();
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [5, 6, 7, 8]);
    expect(result.score).toBeNull();
    expect(result.cloudPosition).toBe("unknown");
    expect(result.cloudBaseM).toBeNull();
    expect(result.cloudTopM).toBeNull();
    expect(result.pressureStatus).toBe("unavailable");
    expect(result.humidity).toBeGreaterThan(80);
    expect(result.summary).toContain("不使用启发式云底补齐");
  });

  it("can safely return a low clear-sky score without pressure when low cloud is minimal", () => {
    const hourly = hourlyFixture({
      cloud_cover_low: [5, 5, 5, 5],
      cloud_cover_mid: [0, 0, 0, 0],
      cloud_cover_high: [5, 5, 5, 5],
      temperature_2m: [15, 15, 15, 15],
      wind_speed_10m: [1.5, 1.5, 1.5, 1.5],
      relative_humidity_2m: [55, 55, 55, 55],
    });
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [5, 6, 7, 8]);
    expect(result.cloudPosition).toBe("clear");
    expect(result.positionLabel).toBe("低云条件不足");
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.cloudBaseM).toBeNull();
    expect(result.cloudTopM).toBeNull();
    expect(result.pressureStatus).toBe("unavailable");
  });

  it("does not require unused surface temperature_2m to publish an otherwise valid result", () => {
    const hourly = hourlyFixture({ temperature_2m: [null, null, null, null] });
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.score).not.toBeNull();
    expect(result.cloudPosition).toBe("above");
  });

  it("returns data-insufficient when a critical provider series is missing", () => {
    const hourly = {
      time: ["2026-09-04T06:00"],
      cloud_cover_low: [80],
      cloud_cover_mid: [10],
      cloud_cover_high: [10],
      temperature_2m: [10],
      wind_speed_10m: [2],
      precipitation: [0],
    };
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [6]);
    expect(result.score).toBeNull();
    expect(result.positionLabel).toBe("数据不足");
    expect(result.summary).toContain("关键云量、湿度、风或降水数据不完整");
  });

  it("uses only hours where all critical surface inputs are simultaneously valid", () => {
    const hourly = hourlyFixture({
      cloud_cover_low: [90, null, null, null],
      cloud_cover_mid: [5, 80, 80, 80],
      cloud_cover_high: [5, 80, 80, 80],
      temperature_2m: [null, null, null, null],
      relative_humidity_2m: [90, 40, 40, 40],
      wind_speed_10m: [1, 10, 10, 10],
      precipitation: [0, 0, 0, 0],
    });
    const pressure = pressureFor(MOCK_HIGH_SITE.id, hourly.time);
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressure,
    );
    expect(result.lowCloud).toBe(90);
    expect(result.humidity).toBe(90);
    expect(result.windSpeed).toBe(1);
    expect(result.peakTime).toBe("05:00");
  });

  it("requires a strict majority of surface-valid hours to be scoreable", () => {
    const hourly = hourlyFixture();
    const pressure = pressureFor(MOCK_HIGH_SITE.id, hourly.time);
    pressure.profiles[hourly.time[2]!] = sparseProfile(5);
    pressure.profiles[hourly.time[3]!] = sparseProfile(5);

    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressure,
    );
    expect(result.score).toBeNull();
    expect(result.pressureStatus).toBe("partial");
    expect(result.summary).toContain("必须超过半数");
  });

  it("does not inflate the condition score merely because inversion evidence is detected", () => {
    const hourly = hourlyFixture();
    const withInversion = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressureFor(MOCK_HIGH_SITE.id, hourly.time, "low-deck", 400, true),
    );
    const withoutInversion = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressureFor(MOCK_HIGH_SITE.id, hourly.time, "low-deck", 400, false),
    );
    expect(withInversion.inversion.status).toBe("detected");
    expect(withoutInversion.inversion.status).toBe("not-detected");
    expect(withInversion.score).toBe(withoutInversion.score);
  });

  it("chooses the highest pressure-aware hourly score as peakTime", () => {
    const hourly = hourlyFixture({
      cloud_cover_low: [80, 82, 80, 75],
      cloud_cover_mid: [80, 5, 70, 60],
      cloud_cover_high: [80, 5, 70, 60],
      temperature_2m: [8, 8, 8, 8],
      relative_humidity_2m: [90, 90, 90, 90],
      wind_speed_10m: [8, 1, 7, 6],
      precipitation: [0, 0, 0, 0],
    });
    const result = evaluateCloudSeaWindow(
      MOCK_HIGH_SITE,
      hourly,
      [5, 6, 7, 8],
      pressureFor(MOCK_HIGH_SITE.id, hourly.time),
    );
    expect(result.peakTime).toBe("06:00");
    expect(result.pressureTime).toBe("2026-09-04T06:00");
  });

  it("does not fall back to unrelated daytime hours when the target window is absent", () => {
    const hourly = {
      ...hourlyFixture(),
      time: [
        "2026-09-04T10:00",
        "2026-09-04T11:00",
        "2026-09-04T12:00",
        "2026-09-04T13:00",
      ],
    };
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [5, 6, 7, 8]);
    expect(result.score).toBeNull();
    expect(result.summary).toContain("目标晨昏窗口没有对应");
  });
});

describe("condition-level and position helpers", () => {
  it("maps condition-index thresholds correctly", () => {
    expect(conditionLevelFor(10)).toBe("p20");
    expect(conditionLevelFor(35)).toBe("p40");
    expect(conditionLevelFor(55)).toBe("p60");
    expect(conditionLevelFor(75)).toBe("p80");
    expect(conditionLevelFor(85)).toBe("p90");
    expect(conditionLevelFor(95)).toBe("p100");
  });

  it("returns appropriate badge tones", () => {
    expect(positionBadgeTone("above")).toBe("good");
    expect(positionBadgeTone("in")).toBe("bad");
    expect(positionBadgeTone("below")).toBe("warn");
    expect(positionBadgeTone("clear")).toBe("muted");
  });
});

describe("cloudseaOverlay IDW grid", () => {
  it("interpolates score grid without crashing", () => {
    const points = [
      { latitude: 30.1, longitude: 118.1, score: 85 },
      { latitude: 29.7, longitude: 102.3, score: 92 },
      { latitude: 36.2, longitude: 117.1, score: 65 },
    ];
    const grid = interpolateScoreGrid(points, 50, 40);
    expect(grid).toBeInstanceOf(Float32Array);
    expect(grid.length).toBe(50 * 40);
    const nonNanCount = Array.from(grid).filter(
      (value) => !Number.isNaN(value),
    ).length;
    expect(nonNanCount).toBeGreaterThan(0);
  });

  it("maps overlay level thresholds correctly", () => {
    expect(levelIndexFor(15)).toBe(0);
    expect(levelIndexFor(25)).toBe(1);
    expect(levelIndexFor(95)).toBe(5);
  });

  it("excludes null-score sites from interpolation", () => {
    const grid = interpolateScoreGrid(
      [
        { latitude: 30, longitude: 110, score: 80 },
        { latitude: 30, longitude: 125, score: null },
      ],
      3,
      3,
      [[30, 110], [30, 125]],
    );
    expect(Number.isFinite(grid[0])).toBe(true);
    expect(Number.isNaN(grid[2])).toBe(true);
  });
});
