import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

// Real app regression using the project's existing fixture network, NOT the
// isolated offline markup used during cloud editing. Run on Node >=24 locally.
const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

async function openTopicSettings(page: Page) {
  const toggle = page.getByRole("button", { name: "展开日期与时段设置" });
  if (await toggle.isVisible()) await toggle.click();
}

for (const width of [320, 390, 768, 1024]) {
  test(`compact ${width}: search targets, map and detail hierarchy`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "compact viewport matrix runs once, in mobile project");
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/?overlay=forecast-cloud&view=combined");
    const filter = page.getByRole("button", { name: "时间与地点筛选", exact: true });
    const locate = page.getByRole("button", { name: "使用我的当前位置" });
    await expect(filter).toBeVisible();
    for (const control of [filter, locate]) {
      const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    const filterBox = await filter.boundingBox();
    const locateBox = await locate.boundingBox();
    expect(Math.abs(filterBox!.y - locateBox!.y)).toBeLessThanOrEqual(1);
    await expect(page.locator(".location-filter-controls")).toBeHidden();
    await filter.click();
    await expect(page.locator(".location-filter-controls")).toBeVisible();
    await page.getByRole("button", { name: "收起时间与地点筛选" }).click();
    await expect(page.locator(".map-stage > .cloud-timeline")).toBeHidden();
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await expect(page.getByTestId("mobile-data-sheet-body").locator(".cloud-timeline")).toBeVisible();
    await expectNoOverflow(page);
  });
}

for (const path of ["/fireglow", "/cloudsea"]) {
  test(`${path}: current context retained with compact settings and data sheet`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "compact topic disclosure");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const groups = page.locator(".app-header .segmented");
    await expect(groups).toHaveCount(2);
    // Touch targets may be large; visual hierarchy and the document budget
    // must still give the forecast/map priority over navigation and settings.
    for (const [width, height] of [[320, 760], [384, 760], [430, 932], [768, 1024], [1024, 768], [812, 375]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(async () => (await page.locator('.app-header').boundingBox())!.height).toBeLessThanOrEqual(48);
      const phaseBox = await groups.first().boundingBox();
      const dateBox = await groups.last().boundingBox();
      expect(Math.abs(phaseBox!.y - dateBox!.y)).toBeLessThanOrEqual(1);
      await expectNoOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.forecast-method-note')).toBeHidden();
    const selected = await groups.last().locator("button.active").innerText();
    await expect(groups.last().locator("button.active")).toBeVisible();
    await expect(groups.last().locator("button:not(.active)").first()).toBeHidden();
    await openTopicSettings(page);
    await expect(groups.last().locator("button:not(.active)").first()).toBeVisible();
    await expect(groups.last().locator("button.active")).toHaveText(selected);
    const requested = groups.last().locator("button").nth(1);
    await requested.click();
    await expect(requested).toHaveClass(/active/);
    await page.getByRole("button", { name: "收起日期与时段设置" }).click();
    await expect(requested).toBeVisible();
    const prefix = path.slice(1);
    await expect(page.locator(".leaflet-container").first()).toBeVisible();
    await expect(page.locator(`.${prefix}-legend`)).toBeHidden();
    const map = await page.locator(".leaflet-container").first().boundingBox();
    expect(map!.height).toBeGreaterThan(400);
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await expect(page.getByText("数据口径与地图色阶")).toBeVisible();
    await expectNoOverflow(page);
  });
}

test("tool drawer Escape restores focus while map sheet remains available", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "compact tool interaction");
  await page.goto("/?overlay=forecast-cloud&view=combined");
  const map = page.locator(".leaflet-container").first();
  await expect(map).toHaveAttribute("data-map-zoom", /\d+/);
  const trigger = page.getByTestId("mobile-map-panel-open-tools");
  const before = await page.evaluate(() => scrollY);
  await trigger.click();
  await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-modal", "true");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await expect(trigger).toBeFocused();
  await expect(page.getByTestId("mobile-data-sheet")).toBeVisible();
});
