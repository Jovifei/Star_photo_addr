import { describe, expect, it } from "vitest";
import { scoreFireGlowSite, type FireGlowSnapshot, type FireGlowWindowScore } from "@/lib/fireglow";
import { FIRE_GLOW_FRESH_MS, fireGlowSiteQuality } from "@/lib/fireglowQuality";
import type { FinderWeatherRecord } from "@/lib/stargazingFinderTypes";

const DATE = "2026-08-22";
const NOW = Date.parse(`${DATE}T08:00:00Z`);
const STAMP = new Date(NOW).toISOString();
const SITE = { id: "rain-test", latitude: 30, longitude: 110 };

function record(precipitation = 0.8, times = Array.from({ length: 24 }, (_, hour) => `${DATE}T${String(hour).padStart(2, "0")}:00`)): FinderWeatherRecord {
  const values = (value: number) => times.map(() => value);
  return {
    status: "available", model: "icon", fetchedAt: STAMP,
    hourly: {
      time: times, weather_code: values(61), cloud_cover: values(75),
      cloud_cover_low: values(8), cloud_cover_mid: values(40), cloud_cover_high: values(30),
      relative_humidity_2m: values(80), dew_point_2m: values(12),
      precipitation_probability: values(90), precipitation: values(precipitation),
      visibility: values(20_000), wind_speed_10m: values(3), wind_gusts_10m: values(6),
      temperature_2m: values(18),
    },
  };
}

function snapshot(window: FireGlowWindowScore): FireGlowSnapshot {
  return {
    date: DATE, model: "icon", generatedAt: STAMP, source: "Open-Meteo", stale: false,
    sites: { [SITE.id]: { morning: window, evening: window } },
    sourceQuality: { version: 1, staleScope: "none", bySite: { [SITE.id]: { status: "available", model: "icon" } } },
    provenance: { version: 1, sourcesBySite: { [SITE.id]: [{
      provider: "Open-Meteo", dataset: "surface", model: "icon",
      sourceFetchedAt: STAMP, providerRunAt: null, observedAt: null,
    }] } },
  };
}

const quality = (value: FireGlowSnapshot, now = NOW) =>
  fireGlowSiteQuality(value, DATE, SITE.id, "evening", "icon", undefined, now);

describe("fireglow null-score outcomes", () => {
  it.each(["morning", "evening"] as const)("retains real weather but no score or best-time recommendation for rainy %s", (phase) => {
    const window = scoreFireGlowSite(SITE, record(), DATE)[phase];
    expect(window).toMatchObject({
      status: "rain-excluded", score: null, band: "none", bandLabel: "降水条件排除",
      probabilityLabel: null, probabilityLevel: null, vividness: null, peakTime: null,
      lowCloud: 8, midCloud: 40, highCloud: 30, visibilityKm: 20, precipitationMm: 0.8,
    });
    expect(window).toHaveProperty("referenceTime", expect.stringContaining(DATE));
    expect(window.reason).toContain("降水");
    expect(window.reason).not.toContain("无法被落日点燃");
    expect(quality(snapshot(window)).state).toBe("excluded");
  });

  it("keeps the exact 0.3 mm scoring boundary unchanged", () => {
    const times = [`${DATE}T19:00`];
    expect(scoreFireGlowSite(SITE, record(0.3, times), DATE).evening.score).not.toBeNull();
    expect(scoreFireGlowSite(SITE, record(0.300001, times), DATE).evening.score).toBeNull();
  });

  it("does not turn missing twilight fields into a precipitation exclusion", () => {
    const value = record(0.8, [`${DATE}T19:00`]);
    value.hourly!.cloud_cover_high[0] = null;
    const window = scoreFireGlowSite(SITE, value, DATE).evening;
    expect(window).toMatchObject({ status: "insufficient", score: null, band: "unknown", highCloud: null });
    expect(quality(snapshot(window)).state).toBe("insufficient");
  });

  it("distinguishes valid daylight samples with no eligible solar window from missing fields", () => {
    const window = scoreFireGlowSite(SITE, record(0, [`${DATE}T12:00`]), DATE).evening;
    expect(window).toMatchObject({ status: "no-solar-window", score: null, bandLabel: "无晨昏窗口" });
    expect(quality(snapshot(window)).state).toBe("no-window");
  });

  it("treats absence of the requested day's samples as missing data, not a solar exclusion", () => {
    const window = scoreFireGlowSite(SITE, record(0, ["2026-08-23T19:00"]), DATE).evening;
    expect(window).toMatchObject({ status: "insufficient", score: null, band: "unknown" });
  });

  it("preserves source-age, stale, model and refresh gates for rainy results", () => {
    const window = scoreFireGlowSite(SITE, record(), DATE).evening;
    const value = snapshot(window);
    expect(quality(value, NOW + FIRE_GLOW_FRESH_MS + 1).state).toBe("expired");
    value.sourceQuality!.bySite[SITE.id].status = "stale";
    expect(quality(value).state).toBe("stale");
    value.sourceQuality!.bySite[SITE.id].status = "available";
    value.sourceQuality!.bySite[SITE.id].model = "gfs";
    expect(quality(value).state).toBe("unknown");
    value.refreshError = "HTTP 429";
    expect(quality(value).state).toBe("refresh-failed");
  });

  it("recognizes only the documented legacy rainy outcome without inventing lost raw values", () => {
    const window = scoreFireGlowSite(SITE, undefined, DATE).evening;
    const legacy = { ...window, status: undefined, band: "none" as const,
      reason: "窗口内降水明显，云层无法被落日点燃。" };
    expect(quality(snapshot(legacy)).state).toBe("excluded");
    expect(legacy.lowCloud).toBeNull();
    expect(legacy.score).toBeNull();
    expect(quality(snapshot({ ...legacy, reason: "未知原因" })).state).toBe("insufficient");
  });

  it("retains a genuine numeric zero and refuses malformed numeric scores", () => {
    const base = scoreFireGlowSite(SITE, record(0, [`${DATE}T19:00`]), DATE).evening;
    expect(quality(snapshot({ ...base, score: 0 })).state).toBe("fresh");
    for (const score of [NaN, Infinity, -1, 101]) {
      expect(quality(snapshot({ ...base, score })).state).toBe("insufficient");
    }
  });
});
