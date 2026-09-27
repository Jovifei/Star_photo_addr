import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test.describe("MOBILE-V2-P0 RED baseline", () => {
  test("home owns one native document scroll and leaves the viewport cage", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile baseline runs in the mobile project");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const shell = page.getByTestId("workspace-shell");
    await expect(shell).toBeVisible();
    await expect(shell).toHaveCSS("overflow", "visible");
    await expect(shell).toHaveCSS("max-height", "none");
    const scroll = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(scroll.scrollHeight).toBeGreaterThanOrEqual(scroll.clientHeight);
  });

  test("topic pages do not lock the document behind a viewport cage", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile baseline runs in the mobile project");
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ["/fireglow", "/cloudsea"]) {
      await page.goto(route);
      const root = page.locator(route === "/fireglow" ? ".fireglow-root" : ".cloudsea-root");
      await expect(root).toBeVisible();
      await expect(root).toHaveCSS("overflow", "visible");
      await expect(root).toHaveCSS("max-height", "none");
    }
  });

  test("tablet layout uses the same document-scroll contract", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile baseline runs in the mobile project");
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    const shell = page.getByTestId("workspace-shell");
    await expect(shell).toHaveCSS("overflow", "visible");
    await expect(shell).toHaveCSS("max-height", "none");
    await expect(page.locator(".map-viewport")).toBeVisible();
  });
});

