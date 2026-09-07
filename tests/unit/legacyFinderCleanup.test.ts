import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FINDER_LOCATIONS } from "@/data/observingSites/catalog";

const legacyRoot =
  "src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2";
const legacyImportFragment =
  "components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
const legacyPublicAsset =
  "public/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/province-boundaries.geojson";
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(fullPath));
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("retired Finder shell cleanup", () => {
  it("keeps the 242-site catalog in the modern data namespace", () => {
    expect(FINDER_LOCATIONS).toHaveLength(242);
    expect(fs.existsSync("src/data/observingSites/catalog.json")).toBe(true);
    expect(fs.existsSync("src/data/observingSites/catalog.ts")).toBe(true);
  });

  it("removes the retired cloned source bridge and public boundary asset", () => {
    expect(fs.existsSync(legacyRoot)).toBe(false);
    expect(fs.existsSync(legacyPublicAsset)).toBe(false);
  });

  it("does not allow source, test or script code to import the retired Finder bridge", () => {
    const offenders = ["src", "tests", "scripts"]
      .flatMap(sourceFiles)
      .filter((file) => fs.readFileSync(file, "utf8").includes(legacyImportFragment));
    expect(offenders).toEqual([]);
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

  it("documents catalog B1–B4 as reference metadata rather than live dark-sky data", () => {
    const readme = fs.readFileSync("README.md", "utf8");
    expect(readme).toContain("目录参考 B1–B4");
    expect(readme).toContain("仅用于点位库筛选与着色");
    expect(readme).toContain("不进入实时天气推荐分");
  });
});
