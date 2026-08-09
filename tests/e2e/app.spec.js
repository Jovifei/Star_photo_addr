import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route(/https:\/\/[^/]+\.basemaps\.cartocdn\.com\/.*/, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));
});

test("3100 上运行的是项目，地图优先且小时矩阵可展开滚动", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".map-stage")).toBeVisible();
  await expect(page.locator(".map-viewport")).toBeVisible();
  await expect(page.locator(".map-headline h1")).toHaveText("今晚云量变化");
  await expect(page.locator(".map-headline h1")).not.toContainText("英仙座流星雨");
  const timelineToggle = page.locator(".cloud-timeline-toggle");
  await expect(timelineToggle).toHaveAttribute("aria-expanded", "false");
  await timelineToggle.click();
  const matrix = page.locator(".hourly-matrix").first();
  await expect(matrix).toBeVisible({ timeout: 15000 });
  await expect(matrix.locator("tbody tr")).toHaveCount(12);
  await expect(matrix.locator("thead tr th")).toHaveCount(11);
  await expect(page.locator('input[type="range"]')).toHaveCount(0);
  await expect(page.locator(".cloud-timeline")).toContainText("云");

  const mapBounds = await page.locator(".map-viewport").boundingBox();
  const timelineBounds = await page.locator(".cloud-timeline").boundingBox();
  expect(mapBounds).not.toBeNull();
  expect(timelineBounds).not.toBeNull();
  expect(timelineBounds.y).toBeGreaterThanOrEqual(mapBounds.y + mapBounds.height - 1);
  const bodyScroll = await page.locator(".cloud-timeline-body").evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(bodyScroll.scrollHeight).toBeGreaterThan(bodyScroll.clientHeight);

  const targetCell = matrix.locator("tbody tr").nth(1).getByRole("button").nth(5);
  await targetCell.focus();
  await targetCell.press("Enter");
  await expect(targetCell).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cloud-timeline-current")).toBeVisible();
  await expect(page.locator(".cloud-canvas-overlay canvas")).toBeVisible({ timeout: 15000 });

  if (testInfo.project.name === "desktop") {
    await page.locator(".cloud-master-toggle").click();
    await expect(matrix).toBeHidden();
    await page.locator(".cloud-master-toggle").click();
    await expect(matrix).toBeVisible();
  }
});

test("规划器使用同源天气网关并复用小时矩阵", async ({ page }) => {
  await page.goto("/planner?lat=30.4694&lng=119.5978&name=天荒坪&elevation=958.4&night=2026-08-12");
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".hero-card")).toBeVisible({ timeout: 15000 });
  await page.locator(".hero-card .detail-cta").click();
  await expect(page.locator(".detail-drawer")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".detail-drawer .hourly-matrix")).toBeVisible();
  await expect(page.locator(".detail-drawer .hourly-matrix tbody tr")).toHaveCount(12);
});

test("卫星图层入口互斥，数据源状态面板可见", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".source-status-panel")).toBeVisible();
  const layerTabs = page.locator('.cloud-control [role="tab"]');
  await expect(layerTabs).toHaveCount(3);
  await layerTabs.nth(1).click();
  await expect(layerTabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测");
  await layerTabs.nth(2).click();
  await expect(layerTabs.nth(2)).toHaveAttribute("aria-selected", "true");
});

test("375、768、1024、1440 宽度无页面级横向溢出", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面项目统一覆盖断点");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    for (const route of ["/", "/sites", "/planner"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
