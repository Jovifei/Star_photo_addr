import { test, expect } from "@playwright/test";
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
  await page.route(/https:\/\/[^/]+\.basemaps\.cartocdn\.com\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
});

async function selectHangzhou(page) {
  await page.getByRole("combobox", { name: "搜索地点、城市或观测点" }).fill("杭州");
  await page.locator(".suggestions li", { hasText: "杭州" }).click();
  await expect(page.locator(".panel-location-name")).toHaveText("杭州", {
    timeout: 15000,
  });
}

test("三个产品入口统一，数据来源弹窗真正居中且高于页面", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "英仙座流星雨" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "页面导航" }).getByRole("link"))
    .toHaveCount(3);

  await page.getByRole("button", { name: "数据依据与局限" }).click();
  const dialog = page.getByRole("dialog", { name: "数据依据与局限" });
  await expect(dialog).toBeVisible();
  const placement = await page.evaluate(() => {
    const modal = document.querySelector(".popover");
    const backdrop = document.querySelector(".popover-backdrop");
    const header = document.querySelector(".topbar");
    const rect = modal?.getBoundingClientRect();
    return {
      centerX: rect ? rect.left + rect.width / 2 : 0,
      centerY: rect ? rect.top + rect.height / 2 : 0,
      viewportX: window.innerWidth / 2,
      viewportY: window.innerHeight / 2,
      backdropZ: Number(getComputedStyle(backdrop).zIndex),
      headerZ: Number(getComputedStyle(header).zIndex),
    };
  });
  expect(Math.abs(placement.centerX - placement.viewportX)).toBeLessThan(3);
  expect(Math.abs(placement.centerY - placement.viewportY)).toBeLessThan(90);
  expect(placement.backdropZ).toBeGreaterThan(placement.headerZ);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("地图云图覆盖范围、三层比例和跨午夜时间轴联动", async ({ page }) => {
  await page.goto("/");
  await selectHangzhou(page);
  await page.getByRole("button", { name: "收起观测详情" }).click();

  await page.locator(".cloud-master-toggle").click();
  const slider = page.getByRole("slider", { name: "云图时间轴" });
  await expect(slider).toBeVisible();
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "9");
  await expect(page.locator(".cloud-timeline-layer")).toHaveCount(3);
  await expect(page.locator(".cloud-timeline")).toContainText("高云");
  await expect(page.locator(".cloud-timeline")).toContainText("中云");
  await expect(page.locator(".cloud-timeline")).toContainText("低云");

  const valuesBefore = await page.locator(".cloud-timeline-layer-value").allTextContents();
  await slider.fill("5");
  await expect(page.locator(".cloud-canvas-overlay")).toHaveAttribute("data-time-index", "5", {
    timeout: 15000,
  });
  const valuesAfter = await page.locator(".cloud-timeline-layer-value").allTextContents();
  expect(valuesAfter).not.toEqual(valuesBefore);
  const canvasSize = await page.locator(".cloud-canvas-overlay canvas").evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
  }));
  expect(canvasSize.width).toBeGreaterThan(100);
  expect(canvasSize.height).toBeGreaterThan(100);
  await expect(page.locator(".cloud-timeline-current")).toContainText(/8\/12.*(次日|0[1-5]:00)/);
});

test("观测夜语义含星期与 20:00 到次日 05:00，并支持排序和增删地点", async ({ page }) => {
  await page.goto("/");
  await selectHangzhou(page);

  const firstDate = page.locator(".star-window-date-col").first();
  await expect(firstDate.getByRole("button")).toHaveAttribute(
    "title",
    /周. 夜间（20:00–次日05:00）/,
  );
  await firstDate.getByRole("button").click();
  await expect(firstDate).toHaveAttribute("aria-sort", "descending");
  await firstDate.getByRole("button").click();
  await expect(firstDate).toHaveAttribute("aria-sort", "ascending");

  const input = page.getByRole("textbox", { name: "添加地点坐标与名称" });
  await input.fill("30.4694,119.5978,天荒坪联动点");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  const row = page.locator(".star-window-table tbody tr", { hasText: "天荒坪联动点" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "删除" }).click();
  await expect(row).toBeHidden();
});

test("推荐观星地点页恢复地图标记、观测夜和最佳窗口", async ({ page }) => {
  await page.goto("/sites");
  await expect(page.getByRole("heading", { name: "推荐观星地点" })).toBeVisible();
  await expect(page.locator(".recommendation-marker-dot")).toHaveCount(20);
  await page.locator(".candidate-row", { hasText: "安吉天荒坪" }).click();
  await expect(page.locator(".viirs-astro-info")).toBeVisible();
  await expect(page.locator(".sites-night-picker select")).toHaveValue("2026-08-12");
  await expect(page.locator(".sites-window-summary")).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: /前往逐星深度分析/ })).toBeVisible();
});

test("星野决策与逐星通过地点和观测夜双向联动", async ({ page }) => {
  // The bridge itself must remain usable even while the external provider is
  // unavailable; the planner should degrade to its explicit empty state.
  await page.route("**/api.open-meteo.com/v1/forecast**", (route) => route.abort());
  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=2026-08-12",
  );
  await expect(page.getByRole("heading", { name: "星野决策" })).toBeVisible();
  await expect(page.locator(".empty-state")).toBeVisible({ timeout: 15000 });
  const backLink = page.getByRole("navigation", { name: "产品导航" }).getByRole("link", { name: "逐星" });
  await expect(backLink).toHaveAttribute("href", /lat=.*name=.*night=2026-08-12/);
  await backLink.click();
  await expect(page).toHaveURL(/\/\?lat=/);
  await expect(page.locator(".panel-location-name")).toContainText("天荒坪", {
    timeout: 15000,
  });
});

test("375、768、1024、1440 宽度三页均无页面级横向溢出", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面项目统一覆盖全部断点");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    for (const route of ["/", "/sites", "/planner"]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
    }
  }
});
