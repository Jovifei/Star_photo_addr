import { describe, expect, it } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { hasCompleteCloudSeaCoverage } from "@/lib/cloudsea";

describe("CloudSea source coverage cache gate", () => {
  const siteCount = CLOUD_SEA_SITES.length;
  const fullCoverage = {
    status: "available" as const,
    availableSites: siteCount,
    totalSites: siteCount,
    failedSites: 0,
  };

  it("requires the full configured site count and internally consistent integer counts", () => {
    expect(hasCompleteCloudSeaCoverage(fullCoverage, siteCount)).toBe(true);
    expect(hasCompleteCloudSeaCoverage({
      ...fullCoverage,
      availableSites: 1,
      totalSites: 1,
    }, siteCount)).toBe(false);
    expect(hasCompleteCloudSeaCoverage({
      ...fullCoverage,
      availableSites: undefined as unknown as number,
    }, siteCount)).toBe(false);
    expect(hasCompleteCloudSeaCoverage({
      ...fullCoverage,
      failedSites: 1,
    }, siteCount)).toBe(false);
    expect(hasCompleteCloudSeaCoverage(undefined, siteCount)).toBe(false);
  });
});
