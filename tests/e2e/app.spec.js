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
  await page.route(/https:\/\/[^/]+\.basemaps\.cartocdn\.com\/.*/, (route) => route.fulfill({
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
  await expect(page.locator(".map-headline h1")).toHaveText("今晚云量变化");
  await expect(page.locator(".map-headline h1")).not.toContainText("英仙座流星雨");
  await openMobileMapPanel(page, "cloud");
  const layerTabs = page.locator('.cloud-tabs[role="tablist"] [role="tab"]');
  await expect(layerTabs).toHaveCount(3);
  await expect(layerTabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测");
  const timelineToggle = page.locator(".cloud-timeline-toggle");
  await expect(timelineToggle).toHaveAttribute("aria-expanded", "false");
  await timelineToggle.click();
  await expect(page.locator(".cloud-observation-note")).toBeVisible();
  await expect(page.locator('input[aria-label="过去 24 小时卫星观测时次"]')).toHaveCount(1);
  await layerTabs.nth(1).click();
  const matrix = page.locator(".hourly-matrix").first();
  await expect(matrix).toBeVisible({ timeout: 15000 });
  await expect(matrix.locator("tbody tr")).toHaveCount(12);
  await expect(matrix.locator("thead tr th")).toHaveCount(11);
  await expect(page.locator('input[aria-label="当前至未来 72 小时预报时次"]')).toHaveCount(1);
  await expect(page.locator('input[aria-label="当前至未来 72 小时预报时次"]')).toHaveAttribute("max", "72");
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

  if (testInfo.project.name === "desktop") await expect(page.locator(".cloud-control")).toBeVisible();
});

test("取样点数据跟随指定模型刷新并说明数据语义", async ({ page }) => {
  await page.goto("/?lat=30.026&lng=119.007&name=%E7%89%B5%E7%89%9B%E5%B2%97&model=gfs&overlay=forecast-cloud");
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".cloud-control")).toBeVisible();
  await expect(page.locator(".cloud-channel-note")).toContainText("取样点", { timeout: 15000 });
  await expect(page.locator(".cloud-channel-note")).toContainText("GFS");
  await expect(page.locator(".cloud-channel-note")).toContainText("天空覆盖百分比");
  await expect(page.locator(".cloud-legend-ticks")).toContainText("100%");
});

test("规划器使用同源天气网关并复用小时矩阵", async ({ page }) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [, month, day] = today.split("-");
  await page.goto(`/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=${today}&model=icon`);
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".hero-card")).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".hero-card h2")).toHaveCount(1);
  await expect(page.locator(".hero-card .section-kicker")).toContainText(`${Number(month)}月${Number(day)}日`);
  await expect(page.locator(".suite-nav a").first()).toHaveAttribute("href", /lat=30\.4694/);
  await expect(page.locator(".suite-nav a").first()).toHaveAttribute("href", /model=icon/);
  const detail = page.locator(".detail-drawer");
  await expect(detail).toBeVisible({ timeout: 15000 });
  const rangeTabs = detail.locator(".detail-range-tabs button");
  await expect(rangeTabs).toHaveCount(4);
  await expect(rangeTabs.nth(0)).toHaveAttribute("aria-pressed", "true");
  const trend = detail.getByTestId("detail-range-trend");
  await expect(trend).toHaveAttribute("data-night-count", "1");
  const oneNightChartKey = await trend.getAttribute("data-chart-key");
  await rangeTabs.nth(3).click();
  await expect(rangeTabs.nth(3)).toHaveAttribute("aria-pressed", "true");
  await expect(trend).toHaveAttribute("data-night-count", "7");
  await expect(trend).not.toHaveAttribute("data-chart-key", oneNightChartKey);
  await expect(detail.locator(".detail-range-feedback")).toContainText("已加载未来 7 夜趋势");
  await expect(detail.locator(".detail-night-strip > button")).toHaveCount(7);
  const targetNight = detail.locator(".detail-night-strip > button").nth(2);
  const targetNightKey = await targetNight.getAttribute("data-night-key");
  const weatherChart = detail.getByTestId("detail-weather-chart");
  const initialWeatherChartKey = await weatherChart.getAttribute("data-chart-key");
  await targetNight.click();
  await expect(targetNight).toHaveAttribute("aria-pressed", "true");
  await expect(detail.locator(".detail-range-panel")).toHaveAttribute("data-active-night", targetNightKey);
  await expect(weatherChart).not.toHaveAttribute("data-chart-key", initialWeatherChartKey);
  const plannerHomeLink = page.locator(".suite-nav a").first();
  await expect.poll(async () => new URL(await plannerHomeLink.getAttribute("href"), "http://local.test").searchParams.get("night")).toBe(targetNightKey);
  const targetHour = detail.locator(".hour-chips button").nth(2);
  const targetTime = await targetHour.getAttribute("data-time");
  await targetHour.click();
  await expect(targetHour).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => new URL(await plannerHomeLink.getAttribute("href"), "http://local.test").searchParams.get("forecastTime")).toBe(targetTime);
  await expect(detail.locator(".hourly-matrix")).toBeVisible();
});

test("地图评分颜色筛选只改变点位，不生成密集永久文字气泡", async ({ page }) => {
  await page.goto("/");
  await openMobileMapPanel(page, "places");
  const control = page.locator(".observing-map-control");
  const map = page.locator(".leaflet-container");
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  const bandOptions = page.locator(".observing-band-option");

  await expect(control).toBeVisible();
  await expect(page.locator(".observing-score-legend input")).toHaveCount(4);
  await expect(page.locator(".observing-site-label")).toHaveCount(0);
  await expect(control).toHaveAttribute("data-score-status", "available", { timeout: 15000 });
  await expect(map).toHaveAttribute("data-observing-snapshot-status", "available", { timeout: 15000 });

  const bandCounts = (await bandOptions.locator("em").allTextContents()).map((value) => Number(value));
  const activeBandIndex = bandCounts.findIndex((value) => Number.isFinite(value) && value > 0);
  expect(activeBandIndex).toBeGreaterThanOrEqual(0);

  const before = Number(await map.getAttribute("data-observing-site-count"));
  const removedCount = bandCounts[activeBandIndex];
  const expectedAfter = before - removedCount;
  expect(before).toBeGreaterThan(0);
  expect(removedCount).toBeGreaterThan(0);
  await expect(markers).toHaveCount(before);

  const bandCheckbox = bandOptions.nth(activeBandIndex).locator('input[type="checkbox"]');
  await bandCheckbox.uncheck();
  await expect(bandCheckbox).not.toBeChecked();
  await expect(map).toHaveAttribute("data-observing-site-count", String(expectedAfter), { timeout: 5000 });
  await expect(markers).toHaveCount(expectedAfter);
});

test("评分时间滑窗会改变当前时次、档位数量和地图筛选基准", async ({ page }) => {
  await page.goto("/");
  await openMobileMapPanel(page, "places");
  const control = page.locator(".observing-map-control");
  const slider = page.getByRole("slider", { name: "观星评分时间滑窗" });
  await expect(control).toBeVisible();
  await expect(slider).toHaveAttribute("max", "72");
  await expect(control).toHaveAttribute("data-score-status", "available", { timeout: 15000 });

  const initialTime = await control.getAttribute("data-score-time");
  const initialCounts = await page.locator(".observing-score-counts").innerText();
  await slider.fill("24");
  await expect.poll(() => control.getAttribute("data-score-time"), { timeout: 5000 }).not.toBe(initialTime);
  await expect(control).toContainText("明天");
  await expect(control).toHaveAttribute("data-score-status", "available");
  await expect.poll(() => page.locator(".observing-score-counts").innerText(), { timeout: 5000 }).not.toBe(initialCounts);

  await slider.fill("48");
  await expect(control).toContainText("后天");
  await expect(control).toHaveAttribute("data-score-status", "available");
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
  const addButton = page.getByRole("button", { name: "加入观星计划候选" });
  await expect(addButton).toBeVisible({ timeout: 15000 });
  await addButton.click();
  await expect(page.getByRole("button", { name: "已加入观星计划" })).toBeDisabled();

  await page.getByRole("link", { name: "观星计划" }).click();
  await expect(page).toHaveURL(/\/planner/);
  await expect(page.locator(".planner-root")).toContainText(selectedName, { timeout: 15000 });
});

test("卫星图层入口互斥，数据源状态面板可见", async ({ page }) => {
  await page.goto("/");
  await openMobileMapPanel(page, "cloud");
  await expect(page.locator(".source-status-panel")).toBeVisible();
  const layerTabs = page.locator('.cloud-tabs[role="tablist"] [role="tab"]');
  await expect(layerTabs).toHaveCount(3);
  await expect(layerTabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".satellite-frame-badge")).toContainText("卫星云观测");
  const initialTile = await page.locator('img[src*="gibs.test"]').first().getAttribute("src");
  await page.locator(".cloud-timeline-play").click();
  await expect.poll(async () => page.locator('img[src*="gibs.test"]').first().getAttribute("src"), { timeout: 5000 }).not.toBe(initialTile);
  await layerTabs.nth(1).click();
  await expect(layerTabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".cloud-canvas-overlay canvas")).toHaveCount(1);
  await expect(page.locator(".satellite-frame-badge")).toHaveCount(0);
  await layerTabs.nth(0).click();
  await expect(page.locator(".cloud-canvas-overlay canvas")).toHaveCount(0);
  await layerTabs.nth(2).click();
  await expect(layerTabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".cloud-source-note")).toContainText("VIIRS 2023");
  await expect(page.locator(".cloud-source-note")).toContainText("非现场 Bortle/SQM");
  await expect(page.locator(".cloud-canvas-overlay canvas")).toHaveCount(0);
});

test("规划详情抽屉左边缘真实拖拽后宽度持久化", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端使用底部抽屉，不启用桌面宽度拖拽");
  await page.goto("/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=2026-08-09&model=gfs");
  const drawer = page.locator(".detail-drawer");
  const resizer = page.locator('[data-testid="planner-detail-resizer"]');
  await expect(drawer).toBeVisible({ timeout: 15000 });
  await expect(resizer).toBeVisible();
  const before = await drawer.evaluate((element) => element.getBoundingClientRect().width);
  const rail = await resizer.boundingBox();
  expect(rail).not.toBeNull();
  const x = rail.x + rail.width / 2;
  const y = rail.y + rail.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 120, y, { steps: 8 });
  await page.mouse.up();
  const after = await drawer.evaluate((element) => element.getBoundingClientRect().width);
  expect(after).toBeGreaterThan(before + 40);
  await expect(resizer).toHaveAttribute("aria-valuenow", String(Math.round(after)));
  await page.reload();
  await expect(drawer).toBeVisible({ timeout: 15000 });
  const restored = await drawer.evaluate((element) => element.getBoundingClientRect().width);
  expect(restored).toBeGreaterThan(before + 40);
});

test("375、768、1024、1440 宽度无页面级横向溢出", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面项目统一覆盖断点");
  const plannerDetailUrl = "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=2026-08-09&model=icon";
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: width < 800 ? 900 : 1000 });
    for (const route of ["/", "/sites", plannerDetailUrl]) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${route} at ${width}px`).toBeLessThanOrEqual(1);
      if (route === plannerDetailUrl) {
        const drawer = page.locator(".detail-drawer");
        await expect(drawer).toBeVisible({ timeout: 15000 });
        if (width <= 768) {
          await drawer.locator(".detail-range-tabs button").last().click();
          const boundaries = await drawer.locator(".detail-range-panel, .detail-range-tabs, [data-testid=detail-range-trend]").evaluateAll((elements) => elements.map((element) => {
            const rect = element.getBoundingClientRect();
            return { left: rect.left, right: rect.right, viewport: window.innerWidth };
          }));
          for (const boundary of boundaries) {
            expect(boundary.left).toBeGreaterThanOrEqual(-1);
            expect(boundary.right).toBeLessThanOrEqual(boundary.viewport + 1);
          }
          const stripScroll = await drawer.locator(".detail-night-strip").evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
          }));
          expect(stripScroll.scrollWidth).toBeGreaterThan(stripScroll.clientWidth);
        }
      }
    }
  }
});
