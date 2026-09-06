import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
import { openMobileMapPanel } from "./mobile-map-panel.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Keep one clean localStorage snapshot per test context, but do not erase
    // persisted drawer widths on a same-test page.reload().
    if (sessionStorage.getItem("e2e-clean-state") !== "1") {
      localStorage.clear();
      sessionStorage.setItem("e2e-clean-state", "1");
    }
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) => route.fulfill({
    status: 200,
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  }));
});

test("首屏导航不会因当前小时变化触发 hydration 警告", async ({ page }) => {
  const hydrationErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|server rendered HTML/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  await page.goto("/");
  await expect(page.locator(".nav-tabs")).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});

test("3100 上运行的是项目，默认卫星观测且预报矩阵可展开滚动", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.locator(".map-stage")).toBeVisible();
  await expect(page.locator(".map-viewport")).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(page.getByTestId("observation-reason-card")).toBeAttached();
    await expect(page.getByTestId("observation-reason-card")).not.toContainText("英仙座流星雨");
  } else {
    await expect(page.getByTestId("mobile-map-panel-dock")).toBeVisible();
  }
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测");
  const timelineToggle = page.locator(".cloud-timeline-toggle:visible");
  await expect(timelineToggle).toHaveAttribute("aria-expanded", "false");
  await timelineToggle.click();
  await expect(page.locator(".cloud-observation-note")).toBeVisible();
  await expect(page.locator('.cloud-track[aria-label*="卫星观测时次轨道"]')).toBeVisible();
  await expect(page.locator('.cloud-track[aria-label*="卫星观测时次轨道"] .cloud-tick')).toHaveCount(3);
  if (testInfo.project.name === "mobile") {
    await openMobileMapPanel(page, "layers");
    await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "false");
  }
  const layerBar = page.getByRole("group", { name: "地图图层模式" });
  await expect(layerBar.getByRole("button")).toHaveCount(4);
  const forecastLayer = layerBar.getByRole("button", { name: "预报", exact: true });
  await forecastLayer.click();
  await expect(forecastLayer).toHaveAttribute("aria-pressed", "true");
  const matrix = page.locator(".hourly-matrix").first();
  await expect(matrix).toBeVisible({ timeout: 15000 });
  await expect(matrix.locator("tbody tr")).toHaveCount(12);
  await expect(matrix.locator("thead tr th")).toHaveCount(11);
  const forecastTrack = page.locator('.cloud-track[aria-label*="预报轨道"]');
  await expect(forecastTrack).toBeVisible();
  await expect(forecastTrack.locator(".cloud-tick")).not.toHaveCount(0);
  await expect(page.locator(".cloud-timeline")).toContainText("云");

  const mapBounds = await page.locator(".map-viewport").boundingBox();
  const timelineBounds = await page.locator(".cloud-timeline").boundingBox();
  expect(mapBounds).not.toBeNull();
  expect(timelineBounds).not.toBeNull();
  await expect.poll(async () => {
    const currentMap = await page.locator(".map-viewport").boundingBox();
    const currentTimeline = await page.locator(".cloud-timeline").boundingBox();
    return currentMap && currentTimeline ? currentTimeline.y - (currentMap.y + currentMap.height) : -Infinity;
  }, { timeout: 2000 }).toBeGreaterThanOrEqual(-1);
  const bodyScroll = await page.locator(".cloud-timeline-body").evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(bodyScroll.scrollHeight).toBeGreaterThan(bodyScroll.clientHeight);

  // Use the hour header as the stable selection target; body rows can be
  // reflowed when the mobile matrix scrolls horizontally.
  const targetCell = matrix.locator("thead button").nth(5);
  await targetCell.focus();
  if (testInfo.project.name === "mobile") {
    // The horizontally scrollable mobile table can move the focused cell out
    // from under the virtual keyboard during Enter synthesis; the same cell's
    // click path exercises the identical state transition on that viewport.
    await targetCell.click();
  } else {
    await targetCell.press("Enter");
  }
  await expect(targetCell).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cloud-timeline-current")).toBeVisible();
  await expect(page.locator(".cloud-canvas-overlay canvas")).toBeVisible({ timeout: 15000 });

  if (testInfo.project.name === "desktop") {
    await page.getByRole("tab", { name: "图层与偏好", exact: true }).click();
    await expect(page.locator(".cloud-control")).toBeVisible();
  }
});

test("取样点数据跟随指定模型刷新并说明数据语义", async ({ page }) => {
  await page.goto("/?lat=30.026&lng=119.007&name=%E7%89%B5%E7%89%9B%E5%B2%97&model=gfs&overlay=forecast-cloud");
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".cloud-control:visible")).toBeVisible();
  await expect(page.locator(".cloud-channel-note:visible")).toContainText("取样点", { timeout: 15000 });
  await expect(page.locator(".cloud-channel-note:visible")).toContainText("GFS");
  await expect(page.locator(".cloud-channel-note:visible")).toContainText("天空覆盖百分比");
  await expect(page.locator(".cloud-legend-ticks:visible")).toContainText("100%");
});

test("规划器兼容链接转入统一观测台并保留地点上下文", async ({ page }) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  await page.goto(`/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=${today}&model=icon`);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  const target = new URL(page.url());
  expect(target.searchParams.get("lat")).toBe("30.4694");
  expect(target.searchParams.get("lng")).toBe("119.5978");
  expect(target.searchParams.get("name")).toBe("天荒坪");
  expect(target.searchParams.get("elevation")).toBe("958.4");
  expect(target.searchParams.get("model")).toBe("icon");
  await expect(page.locator(".map-stage")).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("night")).toBeNull();
  await expect(page.locator(".hourly-matrix")).toBeVisible({ timeout: 15000 });
});

test("暗夜选址 B1 颜色筛选只改变点位，不生成密集永久文字气泡", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端 B1-B4 抽屉卡片由 product-integrity 覆盖");
  await page.goto("/sites");
  const bar = page.getByTestId("bortle-filter-bar");
  const map = page.locator(".leaflet-container");
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  const b1 = bar.getByRole("button", { name: /筛选 B1 点位/ });

  await expect(bar).toBeVisible();
  await expect(page.locator(".observing-site-label")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-observing-site-count", /\d+/, { timeout: 15000 });
  const before = await markers.count();
  const removedCount = await page.locator('.observing-site-dot[data-bortle="1"]').count();
  expect(before).toBeGreaterThan(0);
  expect(removedCount).toBeGreaterThan(0);
  await b1.click();
  await expect(b1).toHaveAttribute("aria-pressed", "false");
  await expect(markers).toHaveCount(before - removedCount);
});

test("暗夜选址 B1-B4 筛选可组合并同步点位数量", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端 B1-B4 抽屉卡片由 product-integrity 覆盖");
  await page.goto("/sites");
  const bar = page.getByTestId("bortle-filter-bar");
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  const b2 = bar.getByRole("button", { name: /筛选 B2 点位/ });
  const b4 = bar.getByRole("button", { name: /筛选 B4 点位/ });
  await expect(markers).toHaveCount(222);
  const initial = await markers.count();
  const b2Count = Number((await b2.getAttribute("aria-label"))?.match(/(\d+) 个$/)?.[1]);
  const b4Count = Number((await b4.getAttribute("aria-label"))?.match(/(\d+) 个$/)?.[1]);
  expect(b2Count).toBeGreaterThan(0);
  expect(b4Count).toBeGreaterThan(0);

  await b4.click();
  await expect(b4).toHaveAttribute("aria-pressed", "true");
  await expect(markers).toHaveCount(initial + b4Count);

  await b2.click();
  await expect(b2).toHaveAttribute("aria-pressed", "false");
  await expect(markers).toHaveCount(initial + b4Count - b2Count);
});

test("地图加入候选后观星计划保留同一地点", async ({ page }) => {
  await page.goto("/");
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  const visibleMarkerIndex = () => markers.evaluateAll((elements) => elements.findIndex((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && rect.left >= 0
      && rect.top >= 0
      && rect.right <= window.innerWidth
      && rect.bottom <= window.innerHeight;
  }));
  await expect.poll(visibleMarkerIndex, { timeout: 15000 }).toBeGreaterThanOrEqual(0);
  const markerIndex = await visibleMarkerIndex();
  const marker = markers.nth(markerIndex);
  await expect(marker).toBeVisible({ timeout: 15000 });
  await marker.click();
  const selectedName = (await page.locator(".panel-location-name").textContent())?.trim();
  expect(selectedName).toBeTruthy();
  const addButton = page.locator(".candidate-add-button");
  await expect(addButton).toBeVisible({ timeout: 15000 });
  await addButton.click();
  await expect(addButton).toContainText("已在候选对比");

  await expect(page.locator(".candidate-leaderboard")).toContainText(selectedName, { timeout: 15000 });
});

test("卫星图层入口互斥，数据源状态面板可见", async ({ page }, testInfo) => {
  await page.goto("/");
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".source-status-panel")).toBeVisible();
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测");
  if (testInfo.project.name === "mobile") {
    await openMobileMapPanel(page, "layers");
    await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "false");
  }
  const layerBar = page.locator(".map-layer-bar:visible");
  await layerBar.getByRole("button", { name: "预报" }).click();
  await expect(page.locator(".cloud-canvas-overlay canvas")).toHaveCount(1);
  await expect(page.locator(".satellite-frame-badge")).toHaveCount(0);
  await layerBar.getByRole("button", { name: "光污染" }).click();
  // Mobile keeps the cloud control inside the drawer; bring it back to the
  // foreground tab before asserting its layer note.
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".cloud-active-layer-note:visible")).toContainText("VIIRS 2023");
  await expect(page.locator(".cloud-active-layer-note:visible")).toContainText("非现场 Bortle/SQM");
  await expect(page.locator(".cloud-canvas-overlay canvas")).toHaveCount(0);
});

test("规划器兼容链接不会创建已退役的独立详情抽屉", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端由单抽屉工作区测试覆盖");
  await page.goto("/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=2026-08-09&model=gfs");
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  await expect(page.getByTestId("workspace-inspector")).toBeVisible();
  await expect(page.locator(".detail-drawer")).toHaveCount(0);
});

test("375、768、1024、1440 宽度下统一工作台无页面级横向溢出", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面项目统一覆盖断点");
  const plannerCompatibilityUrl = "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=2026-08-09&model=icon";
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    for (const route of ["/", "/sites", plannerCompatibilityUrl]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
      if (route === plannerCompatibilityUrl) {
        await expect.poll(() => new URL(page.url()).pathname).toBe("/");
        await expect(page.locator(".detail-drawer")).toHaveCount(0);
      }
    }
  }
});
