import { describe, expect, it } from "vitest";
import {
  assessWeatherCapabilities,
  missingCloudFields,
  sanitizeProbeError,
} from "@/lib/dataSourceHealth";

describe("data source health validation", () => {
  const complete = {
    time: ["2026-08-19T20:00", "2026-08-19T21:00"],
    cloud_cover: [10, 20],
    cloud_cover_low: [5, 8],
    cloud_cover_mid: [12, 15],
    cloud_cover_high: [25, 30],
  };

  it("requires all four cloud channels aligned to the time axis", () => {
    expect(missingCloudFields(complete)).toEqual([]);
    expect(
      missingCloudFields({ ...complete, cloud_cover_mid: [12] }),
    ).toEqual(["中云"]);
    expect(
      missingCloudFields({ ...complete, cloud_cover_high: [null, null] }),
    ).toEqual(["高云"]);
    expect(
      missingCloudFields({ ...complete, cloud_cover_low: [5, "8"] }),
    ).toEqual(["低云"]);
  });

  it("rejects an empty hourly time axis", () => {
    expect(missingCloudFields({ ...complete, time: [] })).toEqual([
      "逐小时时间",
    ]);
  });

  it("separates cloud viewing capability from complete scoring capability", () => {
    const scoringFields = {
      ...complete,
      relative_humidity_2m: [60, 62],
      dew_point_2m: [8, 9],
      precipitation_probability: [0, 0],
      weather_code: [0, 0],
      precipitation: [0, 0],
      visibility: [20_000, 21_000],
      wind_speed_10m: [1, 2],
      wind_gusts_10m: [2, 3],
      temperature_2m: [15, 16],
    };
    expect(assessWeatherCapabilities(scoringFields)).toMatchObject({
      cloudAvailable: true,
      scoringAvailable: true,
      missingCloudFields: [],
      missingScoringFields: [],
    });
    expect(assessWeatherCapabilities({ ...scoringFields, visibility: [null, null] })).toMatchObject({
      cloudAvailable: true,
      scoringAvailable: false,
      missingScoringFields: ["能见度"],
    });
  });

  it("sanitizes provider failures without reflecting URLs or response bodies", () => {
    expect(
      sanitizeProbeError(
        new Error("connect ECONNREFUSED https://internal.example/secret"),
        "天气上游",
      ),
    ).toBe("天气上游暂时不可用");
    expect(
      sanitizeProbeError(new Error("HTTP 429 · quota detail"), "天气上游"),
    ).toBe("天气上游返回 HTTP 429");
    const aborted = new Error("This operation was aborted");
    aborted.name = "AbortError";
    expect(sanitizeProbeError(aborted, "天气上游")).toBe(
      "天气上游请求超时",
    );
  });
});
