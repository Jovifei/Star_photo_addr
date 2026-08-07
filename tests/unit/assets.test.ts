// Unit tests for the public-asset availability registry.
// Contract: assets are OFF unless explicitly opted in, so a repository without
// the licensed bundle never issues requests for files it does not ship.
import { describe, it, expect } from "vitest";
import {
  PUBLIC_ASSETS,
  hasAsset,
  hasDarkSkyLayer,
  isAssetFlagEnabled,
  ASSET_UNAVAILABLE_HINT,
} from "@/lib/assets";
import { fetchCityCandidates, selectFeatured } from "@/data/cities";

describe("isAssetFlagEnabled — 显式开启语义", () => {
  it("接受 1/true/on/yes（大小写与空格不敏感）", () => {
    for (const raw of ["1", "true", "TRUE", " on ", "Yes"]) {
      expect(isAssetFlagEnabled(raw)).toBe(true);
    }
  });

  it("其余一律视为关闭", () => {
    for (const raw of ["0", "false", "off", "no", "", "  ", "maybe"]) {
      expect(isAssetFlagEnabled(raw)).toBe(false);
    }
  });

  it("undefined / null 关闭（默认不启用）", () => {
    expect(isAssetFlagEnabled(undefined)).toBe(false);
    expect(isAssetFlagEnabled(null)).toBe(false);
  });
});

describe("PUBLIC_ASSETS — 默认全部禁用", () => {
  it("四组资源默认关闭", () => {
    expect(PUBLIC_ASSETS.viirsTiles).toBe(false);
    expect(PUBLIC_ASSETS.worldAtlas).toBe(false);
    expect(PUBLIC_ASSETS.cityCandidates).toBe(false);
    expect(PUBLIC_ASSETS.boundaries).toBe(false);
  });

  it("hasAsset 与注册表一致", () => {
    expect(hasAsset("viirsTiles")).toBe(false);
    expect(hasAsset("boundaries")).toBe(false);
  });

  it("无任何栅格源时 hasDarkSkyLayer 为 false", () => {
    expect(hasDarkSkyLayer()).toBe(false);
  });

  it("注册表不可变，避免运行时被误改", () => {
    expect(Object.isFrozen(PUBLIC_ASSETS)).toBe(true);
  });

  it("提供可展示的缺失说明", () => {
    expect(ASSET_UNAVAILABLE_HINT.length).toBeGreaterThan(0);
  });
});

describe("fetchCityCandidates — 缺失时不发请求", () => {
  it("资源未启用时返回 unavailable 且列表为空", async () => {
    // 若这里真的发起了 fetch，Node 测试环境会因无网络/无 baseURL 抛错。
    const result = await fetchCityCandidates();
    expect(result.status).toBe("unavailable");
    expect(result.candidates).toEqual([]);
  });

  it("空列表经 selectFeatured 后仍为空，不产生占位点位", () => {
    expect(selectFeatured([], 34)).toEqual([]);
  });
});
