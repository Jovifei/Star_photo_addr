import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MapSetup from "@/components/MapSetup";

function renderSetup(hidden: boolean): string {
  return renderToStaticMarkup(createElement(MapSetup, { hidden }));
}

describe("MapSetup accessibility lifecycle", () => {
  it("keeps the active loading announcement exposed", () => {
    const markup = renderSetup(false);
    expect(markup).toContain('class="map-setup"');
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('aria-hidden="true"');
    expect(markup).toContain("正在加载地图图层");
  });

  it("hides stale loading semantics after readiness without removing the fade overlay", () => {
    const markup = renderSetup(true);
    expect(markup).toContain('class="map-setup hidden"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("正在加载地图图层");
  });
});
