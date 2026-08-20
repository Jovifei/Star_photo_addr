import { describe, expect, it } from "vitest";
import {
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
