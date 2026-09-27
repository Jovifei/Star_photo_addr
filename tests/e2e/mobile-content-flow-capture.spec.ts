import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
import { closeMobileMapPanel, openMobileMapPanel } from "./mobile-map-panel.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const output = "tmp/mobile-content-flow-capture";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("完整应用手机/平板/横屏/桌面截图证据", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "截图矩阵只执行一次");
  test.setTimeout(180_000);
  mkdirSync(output, { recursive: true });
  const shot = async (name: string, fullPage = false) => {
    await page.screenshot({ path: `${output}/${name}.png`, fullPage });
  };
  const waitForMapPaint = async () => {
    // Screenshot evidence should show the painted basemap when reachable, but
    // external tile outages must not masquerade as a product assertion failure.
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll<HTMLImageElement>(".base-map-tile img")];
      return tiles.length > 0 && tiles.every((tile) => tile.complete);
    }, null, { timeout: 6000 }).catch(() => undefined);
  };

  for (const [width, height] of [[320, 844], [375, 812], [390, 844], [430, 932], [768, 1024], [1024, 768], [812, 375], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?overlay=forecast-cloud&view=combined");
    await expect(page.locator(".leaflet-container")).toHaveAttribute("data-map-zoom", /\d+/, { timeout: 15_000 });
    await expect(page.locator(".map-setup")).toHaveClass(/hidden/, { timeout: 15_000 });
    await waitForMapPaint();
    await expect.poll(() => page.locator(".map-setup").evaluate((node) => Number(getComputedStyle(node).opacity))).toBeLessThan(0.01);
    await shot(`home-${width}x${height}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await expect(page.locator(".leaflet-container")).toHaveAttribute("data-map-zoom", /\d+/, { timeout: 15_000 });
  await expect(page.locator(".map-setup")).toHaveClass(/hidden/, { timeout: 15_000 });
  await waitForMapPaint();
  await expect.poll(() => page.locator(".map-setup").evaluate((node) => Number(getComputedStyle(node).opacity))).toBeLessThan(0.01);
  await shot("home-390-top");
  await page.getByRole("button", { name: "展开数据面板" }).click();
  await shot("home-390-half");
  await page.getByRole("button", { name: "展开数据面板" }).click();
  await shot("home-390-full");
  await page.getByRole("button", { name: "收起数据面板" }).click();
  await page.getByRole("button", { name: "收起数据面板" }).click();
  await page.getByRole("button", { name: "时间与地点筛选" }).click();
  await shot("home-390-filters-expanded");
  await page.getByRole("button", { name: "收起时间与地点筛选" }).click({ force: true });
  for (const panel of ["layers", "places", "cloud", "recommendations"] as const) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
    await openMobileMapPanel(page, panel);
    await shot(`home-390-panel-${panel}`);
    await closeMobileMapPanel(page);
  }

  for (const path of ["/fireglow", "/cloudsea"]) {
    await page.setViewportSize({ width: 390, height: 844 });
    const name = path.slice(1);
    await page.goto(path);
    await expect(page.locator('.leaflet-container')).toHaveAttribute("data-map-zoom", /\d+/, { timeout: 15_000 });
    await waitForMapPaint();
    await shot(`${name}-390-collapsed`);
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await shot(`${name}-390-half`);
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await shot(`${name}-390-full`);
    await page.getByRole("button", { name: "收起数据面板" }).click();
    await page.getByRole("button", { name: "收起数据面板" }).click();
    const mapBox = (await page.locator(".leaflet-container").boundingBox())!;
    await page.touchscreen.tap(mapBox.x + mapBox.width * .28, mapBox.y + mapBox.height * .25);
    await expect(page.getByTestId("mobile-data-sheet")).toHaveAttribute("data-level", "half");
    await shot(`${name}-390-nearby`);
    const adjust = page.getByRole("button", { name: "展开日期与时段设置" });
    await expect(adjust).toBeVisible();
    await adjust.click();
    await shot(`${name}-390-settings-expanded`);
    await page.getByRole("button", { name: "收起日期与时段设置" }).click();
    await page.setViewportSize({ width: 812, height: 375 });
    await page.goto(path);
    await shot(`${name}-812x375`);
  }
});
