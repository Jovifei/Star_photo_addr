import { describe, expect, it } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";
import { buildPressureForecastBatchUrl } from "@/lib/pressure";
import { locationIdentity, resolveLocationTransfer } from "@/lib/locationIdentity";

describe("cloud-sea site identity", () => {
  it.each([
    ["cs-taizijian", 30.1755988, 118.899697, 1558],
    ["cs-qianniugang", 30.0280232, 119.0023557, 1489],
    ["cs-longwangshan", 30.3834495, 119.3985291, 1587],
    ["cs-guniujiang", 30.0494272, 117.4582647, 1727],
    ["cs-lushan", 29.5679323, 115.9987547, 1453],
    ["cs-donglingshan", 40.0309099, 115.4542285, 2303],
  ])("uses the verified %s summit in its provider request", (id, latitude, longitude, altitude) => {
    const site = CLOUD_SEA_SITES.find(item => item.id === id)!;
    expect(site).toMatchObject({ latitude, longitude, altitude });
    const request = new URL(buildPressureForecastBatchUrl([site], "2026-11-01", "gfs", true));
    expect(request.searchParams.get("latitude")).toBe(String(latitude));
    expect(request.searchParams.get("longitude")).toBe(String(longitude));
  });
  it.each([
    ["cs-taizijian", 30.124, 118.918],
    ["cs-qianniugang", 30.082, 119.015],
    ["cs-longwangshan", 30.402, 119.418],
    ["cs-guniujiang", 30.088, 117.485],
    ["cs-lushan", 29.553, 115.987],
    ["cs-donglingshan", 39.971, 115.485],
  ])("keeps an old %s link as a coordinate conflict", (id, latitude, longitude) => {
    const site = CLOUD_SEA_SITES.find(item => item.id === id)!;
    const old = locationIdentity({ ...site, latitude, longitude }, "cloudsea");
    expect(resolveLocationTransfer(old, CLOUD_SEA_SITES, "cloudsea").status).toBe("conflict");
    expect(resolveLocationTransfer(locationIdentity(site, "cloudsea"), CLOUD_SEA_SITES, "cloudsea").site).toEqual(site);
  });
});
