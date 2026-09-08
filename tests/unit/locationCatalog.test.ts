import { describe, expect, it } from "vitest";
import { FINDER_LOCATIONS } from "@/data/observingSites/catalog";
import { DEFAULT_CANDIDATE_SEEDS } from "@/lib/constants";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";

const NEW_FINDER_IDS = [
  "finder-243-location",
  "finder-244-location",
  "finder-245-location",
  "finder-246-location",
  "finder-247-location",
  "finder-248-location",
  "finder-249-location",
  "finder-250-location",
  "finder-251-location",
  "finder-252-location",
];

const NEW_CLOUDSEA_IDS = [
  "cs-maoershan",
  "cs-tianyoufeng",
  "cs-shennongding",
  "cs-balangshan",
  "cs-yunheterraces",
  "cs-jinfoshan",
  "cs-wawushan",
  "cs-subaoding",
  "cs-jiuhuashan",
  "cs-yuanyangbada",
];

describe("curated photography location expansion", () => {
  it("adds the source-backed general locations without duplicate IDs", () => {
    expect(FINDER_LOCATIONS).toHaveLength(252);
    expect(new Set(FINDER_LOCATIONS.map((site) => site.id)).size).toBe(252);
    for (const id of NEW_FINDER_IDS) {
      expect(FINDER_LOCATIONS.some((site) => site.id === id)).toBe(true);
    }
  });

  it("keeps every general location usable for weather and map rendering", () => {
    for (const site of FINDER_LOCATIONS) {
      expect(Number.isFinite(site.latitude)).toBe(true);
      expect(Number.isFinite(site.longitude)).toBe(true);
      expect(site.latitude).toBeGreaterThanOrEqual(-90);
      expect(site.latitude).toBeLessThanOrEqual(90);
      expect(site.longitude).toBeGreaterThanOrEqual(-180);
      expect(site.longitude).toBeLessThanOrEqual(180);
      expect(site.name.trim()).not.toBe("");
      expect(site.reason.trim()).not.toBe("");
    }
    for (const id of NEW_FINDER_IDS) {
      const site = FINDER_LOCATIONS.find((candidate) => candidate.id === id);
      expect(site?.elevation).toBeGreaterThan(0);
    }
  });

  it("adds ten independent CloudSea viewpoints with complete site metadata", () => {
    expect(CLOUD_SEA_SITES).toHaveLength(54);
    expect(new Set(CLOUD_SEA_SITES.map((site) => site.id)).size).toBe(54);
    for (const id of NEW_CLOUDSEA_IDS) {
      expect(CLOUD_SEA_SITES.some((site) => site.id === id)).toBe(true);
    }
    for (const site of CLOUD_SEA_SITES) {
      expect(site.altitude).toBeGreaterThan(0);
      expect(site.name.trim()).not.toBe("");
      expect(site.viewpoint.trim()).not.toBe("");
      expect(site.description.trim()).not.toBe("");
    }
  });

  it("exposes a larger default shortlist without changing user-owned candidates", () => {
    expect(DEFAULT_CANDIDATE_SEEDS).toHaveLength(10);
    expect(new Set(DEFAULT_CANDIDATE_SEEDS.map((site) => site.id)).size).toBe(10);
    expect(DEFAULT_CANDIDATE_SEEDS.map((site) => site.name)).toEqual(
      expect.arrayContaining(["黄山光明顶", "东山岛", "霞浦东壁", "元阳坝达", "景迈山翁基"]),
    );
  });
});
