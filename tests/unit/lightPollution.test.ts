import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIGHT_POLLUTION_TILE_URL,
  lightPollutionTemplateError,
  materializeLightPollutionTile,
  resolveLightPollutionAttribution,
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

  it("accepts and materializes common Leaflet placeholders", () => {
    const template =
      "https://{s}.tiles.example.com/{z}/{x}/{-y}{r}.png";
    expect(lightPollutionTemplateError(template)).toBeNull();
    expect(materializeLightPollutionTile(template, 4, 12, 6)).toBe(
      "https://a.tiles.example.com/4/12/9.png",
    );
  });

  it("uses neutral or sanitized attribution for custom sources", () => {
    expect(
      resolveLightPollutionAttribution(
        "https://tiles.example.com/{z}/{x}/{y}.png",
        "",
      ),
    ).toBe("自定义光污染参考图层");
    expect(
      resolveLightPollutionAttribution(
        "https://tiles.example.com/{z}/{x}/{y}.png",
        "<b>自有数据</b>",
      ),
    ).toBe("自有数据");
    expect(resolveLightPollutionAttribution("", "")).toContain(
      "darkmap.cn",
    );
  });

  it("allows HTTP only for local development hosts", () => {
    expect(
      lightPollutionTemplateError(
        "http://localhost:8080/tiles/{z}/{x}/{y}.png",
      ),
    ).toBeNull();
    expect(
      lightPollutionTemplateError(
        "http://tiles.example.com/{z}/{x}/{y}.png",
      ),
    ).toContain("HTTPS");
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
