import { expect, test, type Page } from "@playwright/test";
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
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org|lpm\.darkmap\.cn)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
});

async function clickVisibleObservingMarker(page: Page) {
  const markers = page.locator(".leaflet-marker-icon.observing-site-marker");
  await expect.poll(() => markers.count(), { timeout: 15000 }).toBeGreaterThan(0);
  const index = await markers.evaluateAll((elements) => elements.findIndex((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0 &&
      rect.right <= window.innerWidth && rect.bottom <= window.innerHeight;
  }));
  expect(index).toBeGreaterThanOrEqual(0);
  await markers.nth(index).click({ force: true });
}

test("参考点位选中后只有 ObservingSitesLayer 持有 marker 与永久标签", async ({ page }) => {
  await page.goto("/sites");
  await expect(page.locator(".observing-site-label")).toHaveCount(0);
  await clickVisibleObservingMarker(page);
  await expect(page.locator(".observing-site-label")).toHaveCount(1);
  await expect(page.locator(".selected-sample-marker")).toHaveCount(0);
});

test("筛选改变后仍 pin 当前参考点位，browse count 不被改写", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "筛选 pin 几何只测桌面，移动选中 owner 由基础用例覆盖");
  await page.goto("/sites");
  await openMobileMapPanel(page, "layers");
  const bar = page.getByTestId("bortle-filter-bar");
  await bar.getByRole("button", { name: /参考 B4 点位/ }).click();
  await clickVisibleObservingMarker(page);
  await expect(page.locator(".observing-site-label")).toHaveCount(1);
  await expect(page.locator(".selected-sample-marker")).toHaveCount(0);

  const b1 = bar.getByRole("button", { name: /参考 B1 点位/ });
  const expectedBrowseCount = Number((await b1.getAttribute("aria-label"))?.match(/(\d+) 个$/)?.[1]);
  expect(expectedBrowseCount).toBeGreaterThan(0);
  await b1.click();
  await expect(page.locator(".observing-site-label")).toHaveCount(1);
  await expect(page.locator(".selected-sample-marker")).toHaveCount(0);
  await expect(page.locator(".leaflet-container")).toHaveAttribute(
    "data-observing-site-count",
    String(expectedBrowseCount),
  );
});

test("搜索或自定义坐标仍由 SampleMarker 持有", async ({ page }) => {
  await page.goto("/?lat=30.1234&lng=120.5678&name=%E6%B5%8B%E8%AF%95%E5%8F%96%E6%A0%B7%E7%82%B9");
  await expect(page.getByTestId("observation-reason-card")).toContainText("测试取样点", { timeout: 20000 });
  await expect(page.locator("[class*='selected-sample-marker']")).toHaveCount(1);
  await expect(page.locator(".observing-site-label")).toHaveCount(0);
});

test("排名 marker 保持临时 Tooltip，不创建永久排名文字", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Leaflet hover/focus characterization 只测桌面");
  await page.goto("/?lat=30.2741&lng=120.1551&name=%E6%9D%AD%E5%B7%9E&model=gfs&view=combined&overlay=forecast-cloud");
  const docked = await openMobileMapPanel(page, "recommendations");
  if (!docked) {
    const expand = page.getByRole("button", { name: "展开当前视野推荐" });
    if ((await expand.count()) > 0 && (await expand.getAttribute("aria-expanded")) !== "true") {
      await expand.click();
    }
  }
  await page.getByRole("button", { name: "生成区域推荐" }).click();
  const marker = page.locator(".leaflet-marker-icon.viewport-rank-marker").first();
  await expect(marker).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".viewport-rank-tooltip:visible")).toHaveCount(0);
  await marker.hover();
  await expect(page.locator(".viewport-rank-tooltip:visible")).toHaveCount(1);
  await marker.focus();
  await expect(page.locator(".viewport-rank-tooltip:visible")).toHaveCount(1);
  await expect(marker).toHaveAttribute("aria-describedby", /.+/);
  await marker.press("Enter");
  await expect(page.locator(".viewport-rank-tooltip:visible")).toHaveCount(1);
  await expect(page.locator(".viewport-rank-tooltip:visible")).toContainText("参考 B");
});
