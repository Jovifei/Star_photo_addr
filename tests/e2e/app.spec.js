import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
import { closeMobileMapPanel, openMobileMapPanel } from "./mobile-map-panel.js";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";

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

test("跨日期进入首页时首屏水合、日期与导航一致", async ({ page }, testInfo) => {
  const browserTime = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await page.clock.setFixedTime(browserTime);
  const hydrationErrors = [];
  page.on("pageerror", (error) => {
    if (/hydration|server rendered HTML|React error #418/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|server rendered HTML|React error #418/i.test(message.text())) {
      hydrationErrors.push(message.text());
    }
  });
  await page.goto("/");
  await expect(page.locator(".nav-tabs")).toBeVisible();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(browserTime);
  const browserHour = Number(dateParts.find((part) => part.type === "hour")?.value ?? "0");
  const eventDate = browserHour < 5
    ? new Date(browserTime.getTime() - 24 * 60 * 60 * 1000)
    : browserTime;
  const eventDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
  }).formatToParts(eventDate);
  const eventMonth = eventDateParts.find((part) => part.type === "month")?.value;
  const eventDay = eventDateParts.find((part) => part.type === "day")?.value;
  const expectedDate = `${Number(eventMonth)}月${Number(eventDay)}日`;
  await expect(page.locator(".event-status")).toContainText(expectedDate);
  if (testInfo.project.name === "mobile") {
    const filter = page.locator(".mobile-filter-toggle");
    await filter.click();
    await expect(filter).toHaveAttribute("aria-expanded", "true");
  } else {
    await expect(page.getByRole("group", { name: "输入栏宽度" })).toBeVisible();
  }
  expect(hydrationErrors).toEqual([]);
});

test("主页默认云量预报与光污染参考，卫星实况需主动选择", async ({ page }, testInfo) => {
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  await expect(page.locator(".map-stage")).toBeVisible();
  await expect(page.locator(".map-viewport")).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(page.getByTestId("observation-reason-card")).toBeAttached();
    await expect(page.getByTestId("observation-reason-card")).not.toContainText("英仙座流星雨");
  } else {
    await expect(page.getByTestId("mobile-map-panel-dock")).toBeVisible();
  }
  await openMobileMapPanel(page, "layers");
  const layerBar = page.getByRole("group", { name: "地图图层模式" });
  const forecastLayer = layerBar.getByRole("button", { name: "预报", exact: true });
  const liveLayer = layerBar.getByRole("button", { name: "实况", exact: true });
  await expect(forecastLayer).toHaveAttribute("aria-pressed", "true");
  await expect(liveLayer).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".satellite-frame-badge")).toHaveCount(0);
  await expect(page.locator('.map-stage > .cloud-timeline')).toHaveAttribute("data-time-domain", "forecast");
  if (testInfo.project.name === "desktop") {
    await expect(page.locator('.cloud-track[aria-label*="预报轨道"]')).toBeVisible({ timeout: 30_000 });
  }

  await liveLayer.click();
  await expect(liveLayer).toHaveAttribute("aria-pressed", "true");
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测", { timeout: 30_000 });
  await closeMobileMapPanel(page);
  if (testInfo.project.name === "mobile") {
    await expandMobileDataSheet(page);
  }
  const timelineToggle = page.locator(".cloud-timeline-toggle:visible");
  if (await timelineToggle.getAttribute("aria-expanded") === "false") await timelineToggle.click();
  await expect(timelineToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".cloud-observation-note:visible")).toBeVisible();
  await expect(page.locator('.cloud-track[aria-label*="卫星观测时次轨道"]:visible')).toBeVisible();
  await expect(page.locator('.cloud-track[aria-label*="卫星观测时次轨道"]:visible .cloud-tick')).toHaveCount(3);
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "收起数据面板" }).click();
    await page.getByRole("button", { name: "收起数据面板" }).click();
    await openMobileMapPanel(page, "layers");
    await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "false");
  }
  await expect(layerBar.getByRole("button")).toHaveCount(4);
  await forecastLayer.click();
  await expect(forecastLayer).toHaveAttribute("aria-pressed", "true");
  await closeMobileMapPanel(page);
  if (testInfo.project.name === "mobile") {
    await expandMobileDataSheet(page);
  }
  const matrix = page.locator(".hourly-matrix:visible").first();
  await expect(matrix).toBeVisible({ timeout: 15000 });
  await expect(matrix.locator("tbody tr")).toHaveCount(12);
  await expect(matrix.locator("thead tr th")).toHaveCount(11);
  const forecastTrack = page.locator('.cloud-track[aria-label*="预报轨道"]:visible');
  await expect(forecastTrack).toBeVisible();
  await expect(forecastTrack.locator(".cloud-tick")).not.toHaveCount(0);
  await expect(page.locator(".cloud-timeline:visible")).toContainText("云");

  const mapBounds = await page.locator(".map-viewport").boundingBox();
  const timelineBounds = await page.locator(".cloud-timeline:visible").boundingBox();
  expect(mapBounds).not.toBeNull();
  expect(timelineBounds).not.toBeNull();
  await expect.poll(async () => {
    const currentMap = await page.locator(".map-viewport").boundingBox();
    const currentTimeline = await page.locator(".cloud-timeline:visible").boundingBox();
    return currentMap && currentTimeline ? currentTimeline.y - (currentMap.y + currentMap.height) : -Infinity;
  }, { timeout: 2000 }).toBeGreaterThanOrEqual(-1);
  const visibleTimeline = page.locator(".cloud-timeline:visible");
  const visibleToggle = visibleTimeline.locator(".cloud-timeline-toggle");
  if (await visibleToggle.getAttribute("aria-expanded") === "false") await visibleToggle.click();
  const bodyScroll = await visibleTimeline.locator(".cloud-timeline-body").evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  if (testInfo.project.name === "mobile") {
    // Compact candidate keeps the timeline in document flow; the page owns
    // vertical scroll instead of creating a nested timeline scroller.
    expect(bodyScroll.scrollHeight).toBeGreaterThanOrEqual(bodyScroll.clientHeight);
  } else {
    expect(bodyScroll.scrollHeight).toBeGreaterThan(bodyScroll.clientHeight);
  }

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
  await expect(page.locator(".cloud-timeline-current:visible")).toBeVisible();
  await expect(page.locator(".cloud-canvas-overlay canvas")).toBeVisible({ timeout: 30_000 });

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

test("规划器兼容链接转入统一观测台并保留地点上下文", async ({ page }, testInfo) => {
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
  if (testInfo.project.name === "mobile") {
    await expandMobileDataSheet(page);
  }
  await expect(page.locator(".hourly-matrix:visible").first()).toBeVisible({ timeout: 15000 });
});

test("暗夜选址 B1 预设门槛同步筛选点位，不生成密集永久文字气泡", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端 B1-B4 抽屉卡片由 product-integrity 覆盖");
  await page.goto("/sites");
  const bar = page.getByTestId("bortle-filter-bar");
  const map = page.locator(".leaflet-container");
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  const b1 = bar.getByRole("button", { name: /参考 B1 点位/ });
  const threshold = page.getByRole("slider", { name: "推荐分数门槛" });

  await expect(bar).toBeVisible();
  await expect(page.locator(".observing-site-label")).toHaveCount(0);
  await expect(map).toHaveAttribute("data-observing-site-count", /\d+/, { timeout: 15000 });
  const before = await markers.count();
  const b1Count = Number((await b1.getAttribute("aria-label"))?.match(/(\d+) 个$/)?.[1]);
  expect(before).toBeGreaterThan(0);
  expect(b1Count).toBeGreaterThan(0);
  await b1.click();
  await expect(b1).toHaveAttribute("aria-pressed", "true");
  await expect(threshold).toHaveValue("85");
  await expect(markers).toHaveCount(b1Count);
});

test("暗夜选址 B1-B4 预设可切换并同步推荐门槛", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端 B1-B4 抽屉卡片由 product-integrity 覆盖");
  await page.goto("/sites");
  const bar = page.getByTestId("bortle-filter-bar");
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  const b2 = bar.getByRole("button", { name: /参考 B2 点位/ });
  const b4 = bar.getByRole("button", { name: /参考 B4 点位/ });
  const threshold = page.getByRole("slider", { name: "推荐分数门槛" });
  await expect(markers).toHaveCount(238);
  const b2Count = Number((await b2.getAttribute("aria-label"))?.match(/(\d+) 个$/)?.[1]);
  const b4Count = Number((await b4.getAttribute("aria-label"))?.match(/(\d+) 个$/)?.[1]);
  expect(b2Count).toBeGreaterThan(0);
  expect(b4Count).toBeGreaterThan(0);

  await b4.click();
  await expect(b4).toHaveAttribute("aria-pressed", "true");
  await expect(threshold).toHaveValue("50");
  await expect(markers).toHaveCount(b4Count);

  await b2.click();
  await expect(b2).toHaveAttribute("aria-pressed", "true");
  await expect(b4).toHaveAttribute("aria-pressed", "false");
  await expect(threshold).toHaveValue("70");
  await expect(markers).toHaveCount(b2Count);
});

test("地图加入候选后观星计划保留同一地点", async ({ page }, testInfo) => {
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
  await expect.poll(visibleMarkerIndex, { timeout: 30_000 }).toBeGreaterThanOrEqual(0);
  const markerIndex = await visibleMarkerIndex();
  const marker = markers.nth(markerIndex);
  await expect(marker).toBeVisible({ timeout: 30_000 });
  await marker.click();
  if (testInfo.project.name === "mobile") {
    await expect(page.getByTestId("mobile-data-sheet")).toHaveAttribute("data-level", "half");
    await expandMobileDataSheet(page);
  }
  const selectedName = (await page.locator(testInfo.project.name === "mobile" ? ".mobile-data-sheet-location" : ".panel-location-name").textContent())?.trim();
  expect(selectedName).toBeTruthy();
  const addButton = page.locator(".candidate-add-button");
  await expect(addButton).toBeVisible({ timeout: 15000 });
  await addButton.click();
  await expect(addButton).toContainText("已在候选对比");

  await expect(page.locator(".candidate-leaderboard")).toContainText(selectedName, { timeout: 15000 });
});

test("卫星图层入口互斥，数据源状态面板可见", async ({ page }, testInfo) => {
  await page.goto("/");
  await openMobileMapPanel(page, "layers");
  const layerBar = page.locator(".map-layer-bar:visible");
  await layerBar.getByRole("button", { name: "实况" }).click();
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".source-status-panel")).toBeVisible();
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测", { timeout: 30_000 });
  if (testInfo.project.name === "mobile") {
    await openMobileMapPanel(page, "layers");
    await expect(page.getByTestId("mobile-map-panel-drawer")).toHaveAttribute("aria-hidden", "false");
  }
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
  // This matrix deliberately performs 12 production navigations. Keep the
  // layout assertions strict but give slower CI runners enough wall-clock time.
  test.setTimeout(240_000);
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
