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

for (const width of [320, 390, 768, 1024]) {
  test(`mobile filter is a secondary sheet at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "mobile matrix runs in the mobile project");
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const filter = page.getByRole("button", { name: "时间与地点筛选", exact: true });
    const locate = page.getByRole("button", { name: "使用我的当前位置" });
    await expect(filter).toBeVisible();
    await expect(locate).toBeVisible();
    const filterBox = await filter.boundingBox();
    const locateBox = await locate.boundingBox();
    expect(filterBox!.height).toBeGreaterThanOrEqual(48);
    expect(locateBox!.height).toBeGreaterThanOrEqual(48);
    expect(Math.abs(filterBox!.y - locateBox!.y)).toBeLessThanOrEqual(1);
    await expect(page.locator(".location-filter-controls")).toHaveCount(0);
    await expect(page.getByTestId("mobile-filter-sheet")).toHaveAttribute("aria-hidden", "true");

    const before = await page.evaluate(() => ({ scrollY: window.scrollY, href: location.href }));
    await filter.click();
    const sheet = page.getByTestId("mobile-filter-sheet");
    await expect(sheet).toHaveAttribute("aria-modal", "true");
    await expect(sheet).toHaveAttribute("aria-hidden", "false");
    await expect(sheet.getByTestId("recommendation-quick-controls")).toBeVisible();
    await expect(page.locator(".location-filter-controls")).toHaveCount(0);
    await sheet.getByRole("button", { name: "关闭时间与地点筛选" }).click();
    await expect(sheet).toHaveAttribute("aria-hidden", "true");
    await expect(filter).toBeFocused();
    expect(await page.evaluate(() => ({ scrollY: window.scrollY, href: location.href }))).toEqual(before);
    await expect(page.locator(".map-viewport")).toBeVisible();
  });
}

for (const width of [1200, 1440]) {
  test(`desktop keeps recommendation controls inline at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "desktop inline controls run in the desktop project");
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("recommendation-quick-controls")).toBeVisible();
    await expect(page.locator(".location-filter-controls")).toBeVisible();
    await expect(page.getByTestId("mobile-filter-sheet")).toHaveCount(0);
  });
}

