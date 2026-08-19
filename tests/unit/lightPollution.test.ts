import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_POLLUTION_TILE_URL,
  lightPollutionTemplateError,
  materializeLightPollutionTile,
} from "@/lib/lightPollution";

describe("light-pollution tile configuration", () => {
  it("materializes the default WMTS template", () => {
    const url = materializeLightPollutionTile(
      DEFAULT_LIGHT_POLLUTION_TILE_URL,
      4,
      12,
      6,
    );
    expect(url).toContain("TileMatrix=EPSG:900913:4");
    expect(url).toContain("TileCol=12");
    expect(url).toContain("TileRow=6");
    expect(url).not.toContain("{z}");
    expect(lightPollutionTemplateError(DEFAULT_LIGHT_POLLUTION_TILE_URL)).toBe(
      null,
    );
  });

  it("rejects a custom template missing required coordinates", () => {
    expect(
      lightPollutionTemplateError("https://tiles.example.com/{z}/{x}.png"),
    ).toContain("{y}");
  });

  it("accepts common Leaflet subdomain and retina placeholders", () => {
    expect(
      lightPollutionTemplateError(
        "https://{s}.tiles.example.com/{z}/{x}/{y}{r}.png",
      ),
    ).toBeNull();
  });

  it("rejects unsupported schemes and embedded credentials", () => {
    expect(
      lightPollutionTemplateError("file:///tmp/{z}/{x}/{y}.png"),
    ).toContain("HTTP");
    expect(
      lightPollutionTemplateError(
        "https://user:secret@tiles.example.com/{z}/{x}/{y}.png",
      ),
    ).toContain("账号或密码");
  });
});
