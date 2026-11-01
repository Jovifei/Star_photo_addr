import { describe, expect, it } from "vitest";
import { deriveCloudLayers } from "@/lib/cloudLayers";
import {
  CLOUD_SEA_EMPTY_WINDOW,
  CLOUD_SEA_SCORE_VERSION,
  evaluateCloudSeaWindow,
  presentCloudSeaSnapshot,
  qualifyCloudSeaSnapshot,
  type CloudSeaSnapshot,
  type CloudSeaWindowScore,
} from "@/lib/cloudsea";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { PRESSURE_LEVELS, type PressureForecastResponse, type PressureLevelSample } from "@/lib/pressure";

const time = "2026-10-30T17:00";
const site = CLOUD_SEA_SITES.find(item => item.id === "cs-damingshan")!;
const sample = (pressure: number, heightMsl: number, cloudy: boolean): PressureLevelSample => ({
  pressure, heightMsl, cloudCover: cloudy ? 85 : 5, humidity: cloudy ? 97 : 55,
  temperature: 10 - heightMsl * 0.006,
});
const singleLayer = [
  sample(1000, 100, false), sample(975, 500, false), sample(950, 900, false),
  sample(925, 1250, false), sample(900, 1550, true), sample(850, 2070, false),
  sample(800, 2700, false), sample(700, 3200, false), sample(600, 4200, false),
  sample(500, 5500, false),
];

function evaluate(altitude: number, profile = singleLayer, windowHours = [17]) {
  const pressure = {
    locationId: site.id, modelElevation: 100, nativeGridElevationM: 100,
    verticalReference: "native-grid-v2", qualifiedPressureLevels: PRESSURE_LEVELS,
    timezone: "UTC", utcOffsetSeconds: 0, fetchedAt: "2026-10-30T00:00:00Z",
    source: "Open-Meteo", model: "gfs", stale: false,
    qualitySchema: "pressure-provider-issues-v1", qualityValidatorVersion: "pressure-validator-v1",
    qualityValidatedAt: "2026-10-30T00:00:00Z", hourly: [{ time, temperature: 10 }],
    profiles: { [time]: profile },
  } as PressureForecastResponse;
  return evaluateCloudSeaWindow({ ...site, altitude }, {
    time: [time], cloud_cover_low: [90], cloud_cover_mid: [5], cloud_cover_high: [5],
    relative_humidity_2m: [98], wind_speed_10m: [2], precipitation: [0],
  }, windowHours, pressure, "2026-10-30");
}

const oldSentence = "数值模式压力剖面显示山顶海拔（1489m）落在低层云 deck（1550–1550m）内，存在云雾包裹风险。";
function oldWindow(current: CloudSeaWindowScore): CloudSeaWindowScore {
  const sentence = current.summary.includes(" 窗口")
    ? current.summary.slice(current.summary.indexOf(" 窗口")) : "";
  return { ...current, positionLabel: "山顶处于云层内", summary: oldSentence + sentence };
}

describe("cloud-sea sampling wording", () => {
  it.each([1489, 1400, 1700])("describes summit %im near a 1550m sample without asserting containment", altitude => {
    const result = evaluate(altitude);
    expect(result).toMatchObject({ cloudPosition: "in", cloudBaseM: 1550, cloudTopM: 1550,
      cloudTopUpperM: 2070, pressureConfidence: "低", score: 22, peakScore: 22 });
    expect(result.positionLabel).toBe("山顶接近或可能处于云层");
    expect(result.summary).toContain("上下各150m余量");
    expect(result.summary).toContain("采样高度并非云体的实测边界");
    expect(result.summary).not.toMatch(/落在.*内|山顶处于云层内/);
  });

  it.each([[1399, "云下"], [1701, "云上"]] as const)("retains the original classification outside the margin at %im", (altitude, relation) => {
    const [layer] = deriveCloudLayers(singleLayer.map(item => ({ ...item, heightMsl: item.heightMsl ?? undefined,
      cloudCover: item.cloudCover ?? undefined, humidity: item.humidity ?? undefined, temperature: item.temperature ?? undefined })), 100, altitude);
    expect(layer.relation).toBe(relation);
    const result = evaluate(altitude);
    expect(result.cloudPosition).not.toBe("in");
    expect(result.summary).not.toMatch(/落在.*内|山顶处于云层内/);
  });

  it("also avoids a definitive boundary for a summit between multiple cloudy samples", () => {
    const multi = singleLayer.map(level => level.pressure === 925 ? sample(925, 1250, true) : level);
    const result = evaluate(1400, multi);
    expect(result).toMatchObject({ cloudPosition: "in", pressureConfidence: "中", score: 22 });
    expect(result.summary).toContain("可能处于有云采样层");
    expect(result.summary).not.toMatch(/落在.*内/);
  });

  it("does not confuse rounded classifier heights with floored API heights", () => {
    const profile = singleLayer.map(level => level.pressure === 900 ? sample(900, 1026, true)
      : level.pressure === 925 ? sample(925, 800, false) : level);
    const [layer] = deriveCloudLayers(profile.map(item => ({ ...item, heightMsl: item.heightMsl ?? undefined,
      cloudCover: item.cloudCover ?? undefined, humidity: item.humidity ?? undefined, temperature: item.temperature ?? undefined })), 100, 1050);
    const result = evaluate(1050, profile);
    expect(layer.baseMsl).toBe(1050);
    expect(result).toMatchObject({ cloudPosition: "in", cloudBaseM: 1000, cloudTopM: 1000, score: 22 });
    expect(result.summary).not.toMatch(/1000|1050|落在.*内/);
  });

  it("makes current-version legacy snapshots match new summaries without changing scores or data", () => {
    const current = evaluate(1489);
    const legacy = oldWindow(current);
    const snapshot: CloudSeaSnapshot = { scoreVersion: CLOUD_SEA_SCORE_VERSION, date: "2026-10-30", model: "gfs",
      generatedAt: "2026-10-30T00:00:00Z", source: "cached fixture", stale: false,
      sites: { [site.id]: { morning: legacy, evening: legacy } } };
    const original = structuredClone(snapshot);
    const presented = presentCloudSeaSnapshot(snapshot);
    expect(presented.sites[site.id].morning).toEqual(current);
    expect(presented.sites[site.id].evening).toEqual(current);
    expect(snapshot).toEqual(original);
    expect(presentCloudSeaSnapshot(presented)).toEqual(presented);
    expect(qualifyCloudSeaSnapshot(snapshot)).toEqual(presented);
  });

  it("retains partial-window context when replacing legacy wording", () => {
    const current = evaluate(1489, singleLayer, [17, 18, 19]);
    const originalSentence = current.summary.slice(current.summary.indexOf("数值模式"));
    const legacy = { ...current, positionLabel: "山顶处于云层内", summary: current.summary.replace(originalSentence, oldSentence) };
    const snapshot: CloudSeaSnapshot = { scoreVersion: CLOUD_SEA_SCORE_VERSION, date: "2026-10-30", model: "gfs",
      generatedAt: "2026-10-30T00:00:00Z", source: "fixture", stale: false,
      sites: { [site.id]: { morning: legacy, evening: CLOUD_SEA_EMPTY_WINDOW } } };
    const presented = qualifyCloudSeaSnapshot(snapshot);
    expect(presented.sites[site.id].morning).toEqual(current);
    expect(presented.sites[site.id].morning).toMatchObject({ score: null, peakScore: 22 });
    expect(presented.sites[site.id].evening).toEqual(CLOUD_SEA_EMPTY_WINDOW);
  });

  it("does not propagate an unrecognized old containment claim", () => {
    const current = evaluate(1489);
    const snapshot: CloudSeaSnapshot = { scoreVersion: CLOUD_SEA_SCORE_VERSION, date: "2026-10-30", model: "gfs",
      generatedAt: "2026-10-30T00:00:00Z", source: "fixture", stale: false,
      sites: { [site.id]: { morning: { ...current, summary: "旧版断言：山顶处于云层内" }, evening: current } } };
    expect(presentCloudSeaSnapshot(snapshot).sites[site.id].morning.summary).toContain("150m余量");
    expect(presentCloudSeaSnapshot(snapshot).sites[site.id].morning.summary).not.toContain("处于云层内");
  });

  it("keeps a fail-closed pressure-quality reason when repairing legacy in-cloud wording", () => {
    const current = evaluate(1489);
    const legacy: CloudSeaWindowScore = {
      ...current,
      cloudPosition: "in",
      score: null,
      peakScore: null,
      positionLabel: "山顶处于云层内",
      summary: "压力层质量 schema 缺失或版本未验证，保留地面事实但暂不评分。 窗口 1/1 个目标时次参与平均条件指数。",
    };
    const snapshot: CloudSeaSnapshot = { scoreVersion: CLOUD_SEA_SCORE_VERSION, date: "2026-10-30", model: "gfs",
      generatedAt: "2026-10-30T00:00:00Z", source: "fixture", stale: false,
      sites: { [site.id]: { morning: legacy, evening: CLOUD_SEA_EMPTY_WINDOW } } };

    const presentedWindow = presentCloudSeaSnapshot(snapshot).sites[site.id]!.morning;

    expect(presentedWindow.summary).toContain("压力层质量 schema 缺失");
    expect(presentedWindow.summary).not.toContain("150m余量");
    expect(presentedWindow.positionLabel).toBe("山顶接近或可能处于云层");
  });
});
