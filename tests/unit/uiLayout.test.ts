import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(
  new URL("../../src/app/globals.css", import.meta.url),
  "utf8",
);
const fireglowCss = readFileSync(
  new URL("../../src/app/fireglow/fireglow.css", import.meta.url),
  "utf8",
);
const cloudseaCss = readFileSync(
  new URL("../../src/app/cloudsea/cloudsea.css", import.meta.url),
  "utf8",
);

describe("responsive layout contracts", () => {
  it("keeps专题根容器 within the viewport when a scrollbar reserves a gutter", () => {
    const fireglowRoot = fireglowCss.match(
      /@media \(max-width: 960px\) \{[\s\S]*?\.fireglow-root\s*\{([\s\S]*?)\r?\n\s*\}/,
    )?.[1] ?? "";
    const cloudseaRoot = cloudseaCss.match(
      /@media \(max-width: 960px\) \{[\s\S]*?\.cloudsea-root\s*\{([\s\S]*?)\r?\n\s*\}/,
    )?.[1] ?? "";
    for (const mobileRoot of [fireglowRoot, cloudseaRoot]) {
      expect(mobileRoot).toMatch(/width:\s*100%/);
      expect(mobileRoot).toMatch(/max-width:\s*100%/);
    }
  });

  it("keeps detail cards from shrinking into clipped strips", () => {
    const detailCard = cloudseaCss.match(/\.cs-detail-card\s*\{([\s\S]*?)\r?\n\}/)?.[1] ?? "";
    expect(detailCard).toMatch(/flex:\s*0\s+0\s+auto/);
  });

  it("gives the mobile header navigation a full-width, single-row scroll band", () => {
    const mediaStart = globalsCss.indexOf("@media (max-width: 900px) {");
    const navStart = globalsCss.indexOf(".app-header .nav-tabs", mediaStart);
    const navEnd = globalsCss.indexOf("}", navStart);
    const navRule = navStart >= 0 && navEnd >= 0
      ? globalsCss.slice(navStart, navEnd)
      : "";
    expect(navRule).toMatch(/flex:\s*0\s+0\s+100%/);
    expect(navRule).toMatch(/min-width:\s*0/);
    expect(navRule).toMatch(/flex-wrap:\s*nowrap/);
  });
});
