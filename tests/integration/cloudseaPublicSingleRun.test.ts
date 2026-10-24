import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeEpochHours } from "@/lib/absoluteForecastTime";
import { evaluateCloudSeaWindow, buildCloudSeaSnapshot, type RawSiteHourly } from "@/lib/cloudsea";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { parsePressureForecast } from "@/lib/pressure";
import { snapshotSourceAgeMs } from "@/lib/snapshotProvenance";

// Public fixed-run GFS input, NOT a photograph or an observed cloud-sea label.
// Archive time is the UTC model INIT time, not sourceFetchedAt/availability.
const rawText = readFileSync(
  new URL("../fixtures/public-single-run-gfs-20261021.json", import.meta.url),
  "utf8",
);
const source = JSON.parse(
  readFileSync(
    new URL("../fixtures/public-single-run-gfs-20261021-source.json", import.meta.url),
    "utf8",
  ),
);
const raw = JSON.parse(rawText);
const site = CLOUD_SEA_SITES.find((candidate) => candidate.id === "cs-fuzhishan");
if (!site) throw new Error("Missing public catalog replay site");

describe("public fixed GFS run / CloudSea date and provenance contract", () => {
  it("replays the 2026-10-22 morning from that calendar date, never 2026-10-21 08:00", () => {
    expect(createHash("sha256").update(rawText).digest("hex")).toBe(source.sha256);
    expect(source.qualification).toBe("PUBLIC_FORECAST_INPUT_ONLY_NOT_GROUND_TRUTH");
    expect(source.runUtc).toBe("2026-10-21T00:00:00Z");
    expect(raw.hourly_units.time).toBe("unixtime");
    expect(raw.hourly_units.wind_speed_10m).toBe("m/s");
    const clocks = normalizeEpochHours(raw.hourly.time, raw.timezone);
    expect(clocks).toHaveLength(48);
    expect(clocks[0]?.time).toBe("2026-10-21T08:00");
    expect(clocks[21]?.time).toBe("2026-10-22T05:00");
    expect(clocks[24]?.time).toBe("2026-10-22T08:00");

    const pressure = parsePressureForecast(raw, site.id, "gfs");
    expect(pressure.timeAxisVersion).toBe("epoch-v1");
    expect(pressure.stale).toBe(false);
    expect(Object.keys(pressure.profilesByEpoch ?? {})).toHaveLength(48);
    expect(pressure.modelElevation).toBe(194);
    expect(site.altitude).toBe(861);

    const hourly: RawSiteHourly = {
      time: clocks.map((clock) => clock.time),
      cloud_cover_low: raw.hourly.cloud_cover_low,
      cloud_cover_mid: raw.hourly.cloud_cover_mid,
      cloud_cover_high: raw.hourly.cloud_cover_high,
      relative_humidity_2m: raw.hourly.relative_humidity_2m,
      wind_speed_10m: raw.hourly.wind_speed_10m,
      precipitation: raw.hourly.precipitation,
    };
    const result = evaluateCloudSeaWindow(
      site,
      hourly,
      [5, 6, 7, 8],
      pressure,
      "2026-10-22",
    );
    // Without date isolation, the first 08:00 is from Oct 21 and is null.
    // The actual Oct 22 08:00 is complete and belongs in the denominator.
    expect(result.coverage).toEqual({
      expectedHours: 4,
      surfaceValidHours: 4,
      scoreableHours: 3,
      pressureHours: 4,
    });
    expect(result.score).toBe(8);
    expect(result.peakScore).toBe(8);
    expect(result.peakTime).toBe("05:00");
    expect(result.conditionLabel).toBe("8/100");
    // The production snapshot builder must bind its actual date as well;
    // it cannot recompute the desired day from the first matching hour.
    const snapshot = buildCloudSeaSnapshot(
      "2026-10-22",
      "gfs",
      { "2026-10-22": { [site.id]: hourly } },
      { [site.id]: pressure },
    );
    expect(snapshot.sites[site.id]?.morning.score).toBe(8);
    expect(snapshot.sites[site.id]?.morning.coverage).toEqual(result.coverage);
    // This historical run has no original acquisition timestamp. Its numeric
    // replay is not fresh forecast evidence or an eligible recommendation.
    expect(snapshot.stale).toBe(true);
    // This is a reproducible forecast INDEX only, not an observed probability.
  });

  it("keeps missing coverage distinct from missing acquisition timestamps", () => {
    const now = new Date().toISOString();
    const date = "2026-10-24";
    const time = [5, 6, 7, 8, 17, 18, 19].map((hour) =>
      `${date}T${String(hour).padStart(2, "0")}:00`,
    );
    const completeSurface: RawSiteHourly = {
      sourceFetchedAt: now,
      time,
      cloud_cover_low: time.map(() => 10),
      cloud_cover_mid: time.map(() => 5),
      cloud_cover_high: time.map(() => 0),
      relative_humidity_2m: time.map(() => 90),
      wind_speed_10m: time.map(() => 1),
      precipitation: time.map(() => 0),
    };
    const onlyOneSite = buildCloudSeaSnapshot(date, "gfs", {
      [date]: { [site.id]: completeSurface },
    });
    expect(onlyOneSite.surface?.status).toBe("partial");
    expect(onlyOneSite.surface?.availableSites).toBe(1);
    expect(onlyOneSite.pressure?.status).toBe("unavailable");
    expect(onlyOneSite.stale).toBe(false);
    expect(snapshotSourceAgeMs(onlyOneSite.provenance)).toBeLessThan(60_000);
    expect(onlyOneSite.provenance?.sourcesBySite[site.id]).toHaveLength(1);
    expect(onlyOneSite.provenance?.sourcesBySite["cs-taizijian"]).toEqual([]);
    // With lowCloud=10 and no pressure, the defined low-cloud-clear branch
    // computes round(8 + 10 * 0.35) = 12; this is NOT the public run's 8.
    expect(onlyOneSite.sites[site.id]?.morning.score).toBe(12);

    const noWeather = buildCloudSeaSnapshot(date, "gfs", {});
    expect(snapshotSourceAgeMs(noWeather.provenance)).toBe(Infinity);
    const invalidSource = buildCloudSeaSnapshot(date, "gfs", {
      [date]: { [site.id]: { ...completeSurface, sourceFetchedAt: "invalid" } },
    });
    expect(snapshotSourceAgeMs(invalidSource.provenance)).toBe(Infinity);
  });
});
