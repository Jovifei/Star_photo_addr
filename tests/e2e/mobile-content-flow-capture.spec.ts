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
  const shot = async (name: string, fullPage = true) => {
    await page.screenshot({ path: `${output}/${name}.png`, fullPage });
  };

  for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768], [812, 375], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/?overlay=forecast-cloud&view=combined");
    await expect(page.locator(".map-viewport")).toBeVisible();
    await shot(`home-${width}x${height}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await shot("home-390-top");
  await page.mouse.wheel(0, 700);
  await shot("home-390-scrolled");
  await page.getByRole("button", { name: "时间与地点筛选" }).click();
  await shot("home-390-filters-expanded");
  await page.getByRole("button", { name: "收起时间与地点筛选" }).click({ force: true });
  for (const panel of ["layers", "places", "cloud", "recommendations"] as const) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
    await openMobileMapPanel(page, panel);
    await shot(`home-390-panel-${panel}`);
    await closeMobileMapPanel(page);
  }
  const summary = page.getByRole("button", { name: /展开观测详情/ });
  if (await summary.count()) {
    await summary.click();
    await shot("home-390-tonight-summary");
    await closeMobileMapPanel(page);
  }

  for (const path of ["/fireglow", "/cloudsea"]) {
    const name = path.slice(1);
    await page.goto(path);
    await shot(`${name}-390-collapsed`);
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
