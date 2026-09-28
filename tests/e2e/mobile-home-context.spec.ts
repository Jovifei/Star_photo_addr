import { expect, test, type Page } from "@playwright/test";
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

async function expectNoOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [1024, 768]]) {
  test(`mobile context strip preserves the active forecast identity at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile matrix runs in the mobile project");
    await page.setViewportSize({ width, height });
    await page.goto("/?overlay=forecast-cloud&view=combined");

    const filter = page.getByRole("button", { name: "时间与地点筛选", exact: true });
    const locate = page.getByRole("button", { name: "使用我的当前位置" });
    await expect(filter).toBeVisible();
    await expect(locate).toBeVisible();
    const filterBox = await filter.boundingBox();
    const locateBox = await locate.boundingBox();
    expect(filterBox!.height).toBeGreaterThanOrEqual(48);
    expect(locateBox!.height).toBeGreaterThanOrEqual(48);
    expect(Math.abs(filterBox!.y - locateBox!.y)).toBeLessThanOrEqual(1);

    const context = page.getByTestId("home-context-strip");
    await expect(context).toBeVisible();
    await expect(context).toContainText(/今晚|今日|明日|后日|月/);
    await expect(context).toContainText(/ICON|GFS|AIFS|BEST_MATCH|未知模型/);
    await expect(context).toContainText(/\d{2}:\d{2}|未选择/);
    await expect(page.getByTestId("mobile-filter-sheet")).toHaveAttribute("aria-hidden", "true");
    await expectNoOverflow(page);

    if (width === 390) {
      const map = await page.locator(".map-viewport").boundingBox();
      expect(map!.height).toBeGreaterThanOrEqual(340);
    }

    const before = await context.innerText();
    await filter.click();
    const sheet = page.getByTestId("mobile-filter-sheet");
    const slider = sheet.getByRole("slider", { name: "观星评分时间滑窗" });
    if (await slider.isEnabled()) {
      await slider.press("ArrowRight");
      await expect.poll(() => context.innerText()).not.toBe(before);
    }
    await page.keyboard.press("Escape");
    await expect(context).toBeVisible();
    await expect(page.getByTestId("mobile-filter-sheet")).toHaveAttribute("aria-hidden", "true");
  });
}

for (const width of [1200, 1440]) {
  test(`desktop keeps context out of the mobile command bar at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop checks run in the desktop project");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?overlay=forecast-cloud&view=combined");
    await expect(page.getByTestId("recommendation-quick-controls")).toBeVisible();
    await expect(page.locator(".location-filter-controls")).toBeVisible();
    await expect(page.getByTestId("home-context-strip")).toBeHidden();
    await expect(page.getByTestId("mobile-filter-sheet")).toHaveCount(0);
  });
}
