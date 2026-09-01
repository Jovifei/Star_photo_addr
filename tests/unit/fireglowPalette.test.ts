import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  new URL("../../src/app/fireglow/FireglowApp.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../../src/app/fireglow/fireglow.css", import.meta.url),
  "utf8",
);

describe("fireglow probability palette", () => {
  it("keeps probability bands out of legacy risk-red colors", () => {
    const levelColors = appSource.match(
      /const LEVEL_COLORS[\s\S]*?\n};/,
    )?.[0];
    expect(levelColors).toBeTruthy();
    expect(levelColors).not.toMatch(/#cb7768/i);
    expect(cssSource).not.toMatch(/#(?:ba2c20|800c0c)/i);
  });
});
