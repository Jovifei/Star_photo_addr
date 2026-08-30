import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";
import { openMobileMapPanel } from "./mobile-map-panel.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("暗夜选址的 B1-B4 卡片可组合筛选并同步点位数量", async ({ page }, testInfo) => {
  await page.goto("/sites");
  let panel = page.locator(".observing-map-control:visible");
  if (testInfo.project.name === "mobile") {
    await openMobileMapPanel(page, "places");
    const drawer = page.getByTestId("mobile-map-panel-drawer");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    panel = drawer.locator(".observing-map-control");
  } else {
    await page.getByRole("tab", { name: "地点" }).click();
    panel = page.locator(".observing-map-control:visible");
  }
  await expect(panel).toBeVisible();
  const cards = panel.locator(".observing-baseline-chip");
  await expect(cards).toHaveCount(4);
  await expect(cards.nth(0)).toHaveAttribute("aria-pressed", "true");
  await expect(cards.nth(3)).toHaveAttribute("aria-pressed", "false");

  await cards.nth(3).click();
  await expect(cards.nth(3)).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toContainText("B1–B4");

  await cards.nth(1).click();
  await expect(cards.nth(1)).toHaveAttribute("aria-pressed", "false");
  await expect(panel).toContainText("B1、B3、B4");
});

test("稀疏坐标启用附近推荐时自动补最近观测点，关闭后恢复基础池", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面仪表盘负责验证附近推荐列表的数量变化");
  await page.goto("/planner?lat=42.97&lng=97.43&name=%E5%8F%96%E6%A0%B7%E7%82%B9");
  const nearby = page.locator('[aria-label="附近观星点推荐范围"]');
  await expect(nearby).toBeVisible();
  await nearby.getByRole("button", { name: "200 km" }).click();
  await expect(page.locator(".nearby-hint")).toContainText("另补最近", { timeout: 20000 });
  await expect(page.locator(".rank-card")).toHaveCount(9, { timeout: 20000 });

  await nearby.getByRole("button", { name: "关闭" }).click();
  await expect(page.locator(".nearby-hint")).toHaveCount(0);
  await expect(page.locator(".rank-card")).toHaveCount(1);
});

test("火烧云地图在宽屏占满工作区而不是被 1680px 中心限宽", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "宽屏几何只在桌面项目验证");
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto("/fireglow");
  const workspace = page.locator(".fireglow-workspace");
  await expect(workspace).toBeVisible();
  const box = await workspace.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeLessThanOrEqual(1);
  expect(box!.x + box!.width).toBeGreaterThanOrEqual(1919);
  const panel = await page.locator(".fireglow-panel").boundingBox();
  const map = await page.locator(".fireglow-map").boundingBox();
  expect(panel?.x ?? 999).toBeLessThanOrEqual(20);
  expect((map?.x ?? 0) + (map?.width ?? 0)).toBeGreaterThanOrEqual(1900);
});

test("火烧云主要控制保持至少 44px 触控高度", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "触控高度只需桌面项目验证一次");
  await page.goto("/fireglow");
  const controls = page.locator(".fireglow-controls button:visible");
  await expect(controls).toHaveCount(7);
  const heights = await controls.evaluateAll((buttons) =>
    buttons.map((button) => button.getBoundingClientRect().height),
  );
  expect(heights.every((height) => height >= 44)).toBe(true);
});

test("火烧云选中点详情进入独立证据列", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "三栏结构只需桌面验证");
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-08-30";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: "2026-08-30T12:00:00.000Z",
        source: "E2E fireglow snapshot",
        stale: false,
        sites: {},
      }),
    });
  });
  await page.goto("/fireglow");
  await page.locator(".fireglow-list button").first().click();
  const inspector = page.locator(".fireglow-workspace > .fireglow-inspector");
  await expect(inspector).toBeVisible();
  await expect(page.locator(".fireglow-panel .fireglow-inspector")).toHaveCount(0);
  const panelBox = await page.locator(".fireglow-panel").boundingBox();
  const mapBox = await page.locator(".fireglow-map").boundingBox();
  const inspectorBox = await inspector.boundingBox();
  expect(panelBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  expect(inspectorBox).not.toBeNull();
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(mapBox!.x + 1);
  expect(mapBox!.x + mapBox!.width).toBeLessThanOrEqual(inspectorBox!.x + 1);
});

test("当前时次评分不可用时明确显示数据不足，不把未知点当低分", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "评分未知态只需桌面主地图回归一次");
  await page.route("**/api/observing/snapshot**", async (route) => {
    const url = new URL(route.request().url());
    const focusTime = url.searchParams.get("time");
    const body = {
      date: url.searchParams.get("date") ?? "2026-08-26",
      days: 1,
      model: url.searchParams.get("model") ?? "icon",
      generatedAt: "2026-08-26T00:00:00.000Z",
      source: "E2E unknown snapshot",
      stale: true,
      sites: {},
      ...(focusTime ? { focusTime, focusScores: {} } : {}),
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await page.getByRole("tab", { name: "地点" }).click();
  const panel = page.locator(".observing-map-control:visible");
  await expect(panel).toHaveAttribute("data-score-status", "degraded", { timeout: 15000 });
  await expect(panel).toContainText("灰色点代表未知，不等同于低分");
  await expect(panel.locator(".observing-unknown-option")).toContainText("数据不足");
});

test("卫星强制刷新失败时保留上一帧并标记降级", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "卫星刷新保留上一帧只需桌面地图回归一次");
  await page.route("**/api/satellite/times**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("refresh") === "1") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "测试中的卫星上游不可用" }) });
      return;
    }
    await route.fallback();
  });
  await page.goto("/?overlay=satellite-cloud&view=satellite");
  await expect(page.locator(".satellite-frame-badge")).toBeVisible({ timeout: 15000 });
  await page.getByRole("tab", { name: "云量", exact: true }).click();
  const refresh = page.getByRole("button", { name: "强制刷新天气、卫星目录和数据源状态" });
  await refresh.click();
  await expect(page.locator(".satellite-layer-error")).toContainText("测试中的卫星上游不可用", { timeout: 15000 });
  await expect(page.locator(".satellite-frame-badge")).toBeVisible();
});
