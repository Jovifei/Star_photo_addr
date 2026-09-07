import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { FINDER_LOCATIONS } from "@/data/observingSites/catalog";

const legacyRoot =
  "src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2";

const retiredUiFiles = [
  "FinderLegend.tsx",
  "FinderMap.tsx",
  "FinderReviewModal.tsx",
  "FinderStatus.tsx",
  "LocationDetail.tsx",
  "StargazingFinderApp.tsx",
  "TopFilterBar.tsx",
  "stargazing-finder.module.css",
  "finder-locations.json",
];

describe("retired Finder shell cleanup", () => {
  it("keeps the 242-site catalog in the modern data namespace", () => {
    expect(FINDER_LOCATIONS).toHaveLength(242);
    expect(fs.existsSync("src/data/observingSites/catalog.json")).toBe(true);
    expect(fs.existsSync("src/data/observingSites/catalog.ts")).toBe(true);
  });

  it("removes the retired cloned UI while leaving only a temporary import bridge", () => {
    for (const file of retiredUiFiles) {
      expect(fs.existsSync(`${legacyRoot}/${file}`)).toBe(false);
    }
    const bridge = fs.readFileSync(`${legacyRoot}/finderData.ts`, "utf8");
    expect(bridge).toContain("@deprecated");
    expect(bridge).toContain("@/data/observingSites/catalog");
  });

  it("moves the elevation backfill script to the modern catalog path", () => {
    const script = fs.readFileSync("scripts/backfill-finder-elevations.mjs", "utf8");
    expect(script).toContain("../src/data/observingSites/catalog.json");
    expect(script).not.toContain("finder-locations.json");
  });

  it("keeps the old Finder URL as a noindex compatibility redirect", () => {
    const page = fs.readFileSync("src/app/stargazing-finder-dark/page.tsx", "utf8");
    expect(page).toContain("buildLightPollutionRedirect");
    expect(page).toContain("index: false");
    expect(page).toContain("follow: false");
    expect(page).not.toContain("公测版");
  });
});
