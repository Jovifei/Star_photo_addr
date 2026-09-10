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
  "finder-253-location",
  "finder-254-location",
  "finder-255-location",
  "finder-256-location",
  "finder-257-location",
  "finder-258-location",
  "finder-259-location",
  "finder-260-location",
  "finder-261-location",
  "finder-262-location",
  "finder-263-location",
  "finder-264-location",
  "finder-265-location",
  "finder-266-location",
  "finder-267-location",
  "finder-268-location",
  "finder-269-location",
  "finder-270-location",
  "finder-271-location",
  "finder-272-location",
  "finder-273-location",
  "finder-274-location",
  "finder-275-location",
  "finder-276-location",
  "finder-277-location",
  "finder-278-location",
  "finder-279-location",
  "finder-280-location",
  "finder-281-location",
  "finder-282-location",
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
    expect(FINDER_LOCATIONS).toHaveLength(282);
    expect(new Set(FINDER_LOCATIONS.map((site) => site.id)).size).toBe(282);
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

  it("keeps the Zhoushan island picks tied to their named photography spots", () => {
    const expected = {
      "finder-253-location": ["朱家尖大青山猫跳", 29.84823, 122.393101],
      "finder-254-location": ["东极岛庙子湖", 30.193518, 122.686982],
      "finder-255-location": ["枸杞岛山海奇观", 30.70492, 122.781567],
      "finder-256-location": ["嵊山岛东崖绝壁", 30.701761, 122.835933],
      "finder-257-location": ["花鸟岛前坑顶", 30.845996, 122.685613],
    } as const;
    for (const [id, [name, latitude, longitude]] of Object.entries(expected)) {
      const site = FINDER_LOCATIONS.find((candidate) => candidate.id === id);
      expect(site).toMatchObject({ name, latitude, longitude, province: "浙江", bortle: 4 });
    }
  });

  it("keeps the Hangzhou-area mountain anchors aligned to public POI coordinates", () => {
    expect(FINDER_LOCATIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "finder-226-location",
          name: "临安牵牛岗",
          latitude: 30.025903,
          longitude: 119.007399,
        }),
        expect.objectContaining({
          id: "finder-232-location",
          name: "临安太子尖",
          latitude: 30.175219,
          longitude: 118.897919,
        }),
      ]),
    );
  });

  it("covers every mainland provincial-level region represented by the guide", () => {
    const provinces = new Set(FINDER_LOCATIONS.map((site) => site.province));
    expect(provinces.size).toBe(31);
    expect(provinces.has("天津")).toBe(true);
    expect(FINDER_LOCATIONS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "finder-282-location",
          name: "天津蓟州九山顶",
          province: "天津",
        }),
      ]),
    );
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
    expect(DEFAULT_CANDIDATE_SEEDS).toHaveLength(17);
    expect(new Set(DEFAULT_CANDIDATE_SEEDS.map((site) => site.id)).size).toBe(17);
    expect(DEFAULT_CANDIDATE_SEEDS.map((site) => site.name)).toEqual(
      expect.arrayContaining([
        "黄山光明顶",
        "东山岛",
        "霞浦东壁",
        "元阳坝达",
        "景迈山翁基",
        "朱家尖大青山猫跳",
        "开化高田坑村",
        "东白山太白峰",
        "东至星空之城",
        "闽侯大湖888观景台",
        "铅山葛仙村摘星楼",
        "宝兴达瓦更扎",
      ]),
    );
  });
});
