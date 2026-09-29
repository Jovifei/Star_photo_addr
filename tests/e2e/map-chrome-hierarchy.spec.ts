import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("桌面地图只保留高频画布工具，低频说明进入折叠区", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面地图 IA 只测桌面");
  await page.goto("/?overlay=forecast-cloud&view=combined");

  // Switch the inspector before the map's lazy layers finish settling; this
  // avoids waiting on an animating canvas while the tab remains stable.
  await page.getByRole("tab", { name: "图层与偏好", exact: true }).click();
  const viewport = page.locator(".map-viewport");
  await expect(viewport.locator(".map-layer-bar")).toBeVisible();
  await expect(viewport.locator(".map-boundary-status")).toHaveCount(0);
  await expect(viewport.locator(".map-reference-tools")).toHaveCount(0);
  await expect(viewport.locator(".map-panel-manager")).toHaveCount(0);

  const panel = page.getByRole("tabpanel", { name: "图层与偏好" });
  const references = panel.locator(".map-reference-tools");
  await expect(references).toBeVisible();
  await expect(references).not.toHaveAttribute("open");
  await expect(panel.locator(".observing-map-control")).toBeVisible();
  await expect(panel.locator(".bortle-control")).toBeVisible();
  await expect(panel.locator(".cloud-control")).toBeVisible();
  await expect(panel.locator(".viewport-recommendation-panel")).toBeVisible();

  await references.locator("summary").click();
  await expect(references.locator(".map-view-actions")).toBeVisible();
  await expect(references.locator(".map-legend")).toBeVisible();
  await expect(references.locator(".map-view-actions")).toHaveCSS("position", "static");
  await expect(references.locator(".map-legend")).toHaveCSS("position", "static");
  const boundary = references.locator(".map-boundary-status");
  if (await boundary.count()) await expect(boundary).toHaveCSS("position", "static");
});

test("移动端图层默认稀疏，说明与视图按需展开", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "移动端地图 IA 只测移动端");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?overlay=forecast-cloud&view=combined");

  const dock = page.getByTestId("mobile-map-panel-dock");
  await expect(dock).toBeVisible();
  await page.getByTestId("mobile-map-panel-open-tools").click();
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  const references = drawer.locator(".map-reference-tools");
  await expect(drawer.locator(".map-layer-bar")).toBeVisible();
  await expect(drawer.locator(".bortle-control")).toBeVisible();
  await expect(references).toBeVisible();
  await expect(references).not.toHaveAttribute("open");
  const summaryBox = await references.locator("summary").boundingBox();
  expect(summaryBox).not.toBeNull();
  expect(summaryBox!.height).toBeGreaterThanOrEqual(48);
  await expect(references.locator(".map-view-actions")).toBeHidden();
  await expect(references.locator(".map-legend")).toBeHidden();

  await references.locator("summary").click();
  await expect(references.locator(".map-view-actions")).toBeVisible();
  await expect(references.locator(".map-legend")).toBeVisible();
  expect(await drawer.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test("短横屏继续使用侧栏，低频工具不回到地图浮窗", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "短横屏地图 IA 只测移动端");
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await page.getByTestId("mobile-map-panel-open-tools").click();

  const drawer = page.getByTestId("mobile-map-panel-drawer");
  const references = drawer.locator(".map-reference-tools");
  await expect(drawer).toBeVisible();
  await expect(drawer.locator(".map-layer-bar")).toBeVisible();
  const summaryBox = await references.locator("summary").boundingBox();
  expect(summaryBox).not.toBeNull();
  expect(summaryBox!.height).toBeGreaterThanOrEqual(48);
  await expect(references.locator(".map-view-actions")).toBeHidden();
  await references.locator("summary").click();
  await expect(references.locator(".map-view-actions")).toBeVisible();
  await expect(references.locator(".map-legend")).toBeVisible();
  await expect(page.locator(".map-viewport > .map-panel-manager")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});
