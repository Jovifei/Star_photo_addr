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
const transparentTile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.fulfill({ status: 503, contentType: "text/plain", body: "tile unavailable" }),
  );
  await page.route("https://gibs.test/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: transparentTile }),
  );
});

function assertInside(outer: { x: number; y: number; width: number; height: number }, inner: { x: number; y: number; width: number; height: number }) {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x - 1);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y - 1);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 1);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 1);
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

test("桌面 render status 分 lane 且避开图层条", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面 safe-zone 只测桌面");
  await page.goto("/?overlay=satellite-cloud&view=satellite");

  const map = page.locator(".map-viewport");
  const tile = page.getByTestId("map-tile-render-status");
  const satellite = page.getByTestId("satellite-render-status");
  await expect(tile).toBeVisible({ timeout: 15000 });
  await expect(satellite).toBeVisible({ timeout: 30000 });

  const mapBox = await map.boundingBox();
  const tileBox = await tile.boundingBox();
  const satelliteBox = await satellite.boundingBox();
  const layerBarBox = await page.locator(".map-viewport .map-layer-bar").boundingBox();
  expect(mapBox).not.toBeNull();
  expect(tileBox).not.toBeNull();
  expect(satelliteBox).not.toBeNull();
  expect(layerBarBox).not.toBeNull();
  assertInside(mapBox!, tileBox!);
  assertInside(mapBox!, satelliteBox!);
  expect(overlaps(tileBox!, satelliteBox!)).toBe(false);
  expect(tileBox!.y).toBeGreaterThanOrEqual(layerBarBox!.y + layerBarBox!.height - 1);
  expect(await tile.getAttribute("data-testid")).toBe("map-tile-render-status");
  await expect(tile).toContainText("当前画布不代表天气数据为空");
  await expect(page.locator(".satellite-layer-error")).toHaveCount(0);
});

test("手机竖屏 render status 避开工具 rail 与数据表", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "手机 safe-zone 只测移动端");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?overlay=satellite-cloud&view=satellite");

  const map = page.locator(".map-viewport");
  const tile = page.getByTestId("map-tile-render-status");
  const satellite = page.getByTestId("satellite-render-status");
  const rail = page.getByTestId("mobile-map-panel-open-tools");
  await expect(tile).toBeVisible({ timeout: 15000 });
  await expect(satellite).toBeVisible({ timeout: 30000 });
  const mapBox = await map.boundingBox();
  const tileBox = await tile.boundingBox();
  const satelliteBox = await satellite.boundingBox();
  const railBox = await rail.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(tileBox).not.toBeNull();
  expect(satelliteBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  assertInside(mapBox!, tileBox!);
  assertInside(mapBox!, satelliteBox!);
  expect(overlaps(tileBox!, satelliteBox!)).toBe(false);
  expect(overlaps(satelliteBox!, railBox!)).toBe(false);
  const retryBox = await tile.getByRole("button", { name: "重试地图图层" }).boundingBox();
  expect(retryBox).not.toBeNull();
  expect(retryBox!.height).toBeGreaterThanOrEqual(48);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("短横屏 render status 保持左右 safe zones，抽屉覆盖状态徽章", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "短横屏 safe-zone 只测移动端");
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto("/?overlay=satellite-cloud&view=satellite");

  const map = page.locator(".map-viewport");
  const tile = page.getByTestId("map-tile-render-status");
  const satellite = page.getByTestId("satellite-render-status");
  const rail = page.getByTestId("mobile-map-panel-open-tools");
  await expect(tile).toBeVisible({ timeout: 15000 });
  await expect(satellite).toBeVisible({ timeout: 30000 });
  const mapBox = await map.boundingBox();
  const tileBox = await tile.boundingBox();
  const satelliteBox = await satellite.boundingBox();
  const railBox = await rail.boundingBox();
  expect(mapBox).not.toBeNull();
  expect(tileBox).not.toBeNull();
  expect(satelliteBox).not.toBeNull();
  expect(railBox).not.toBeNull();
  assertInside(mapBox!, tileBox!);
  assertInside(mapBox!, satelliteBox!);
  expect(overlaps(tileBox!, satelliteBox!)).toBe(false);
  expect(overlaps(satelliteBox!, railBox!)).toBe(false);
  const retryBox = await tile.getByRole("button", { name: "重试地图图层" }).boundingBox();
  expect(retryBox).not.toBeNull();
  expect(retryBox!.height).toBeGreaterThanOrEqual(48);

  await page.getByTestId("mobile-map-panel-open-tools").click();
  await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "false");
  const statusZ = await satellite.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  const dockZ = await page.getByTestId("mobile-map-panel-dock").evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex, 10));
  expect(dockZ).toBeGreaterThan(statusZ);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
