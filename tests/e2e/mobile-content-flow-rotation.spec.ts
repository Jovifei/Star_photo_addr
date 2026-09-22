import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("compact drawer survives rotation, restores scroll and focus", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await page.mouse.wheel(0, 420);
  const before = await page.evaluate(() => scrollY);
  const trigger = page.getByRole("button", { name: /展开观测详情/ });
  await trigger.click();
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  expect(await page.evaluate(() => document.body.style.position)).toBe("fixed");

  await page.setViewportSize({ width: 812, height: 375 });
  await expect(drawer).toBeVisible();
  const rotated = await drawer.boundingBox();
  expect(rotated).not.toBeNull();
  expect(rotated!.height).toBeGreaterThanOrEqual(370);
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.position)).toBe("");
});

test("compact header remains operable with measured 200% CSS text stress", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "时间与地点筛选" })).toBeVisible();
  // Explicit text-only stress simulation. Browser shortcuts alone do not
  // establish OS text scaling or a measured zoom level in headless Chromium.
  const ratio = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>('.mobile-filter-toggle')!;
    const before = parseFloat(getComputedStyle(button).fontSize);
    const targets = [...document.querySelectorAll<HTMLElement>('.app-header *, .workspace-commandbar *')]
      .filter(el => el.namespaceURI === 'http://www.w3.org/1999/xhtml');
    const sizes = targets.map(el => parseFloat(getComputedStyle(el).fontSize));
    targets.forEach((el, index) => el.style.setProperty('font-size', `${sizes[index] * 2}px`, 'important'));
    return parseFloat(getComputedStyle(button).fontSize) / before;
  });
  expect(ratio).toBeCloseTo(2, 2);
  await page.getByRole('button', {name:'时间与地点筛选'}).click();
  await expect(page.getByRole('slider',{name:'推荐分数门槛'})).toBeVisible();
  await page.getByRole('button',{name:'收起时间与地点筛选'}).click();
  await expect(page.getByRole("button", { name: "时间与地点筛选" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
