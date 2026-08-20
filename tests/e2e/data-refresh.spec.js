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
  await page.route(
    /https:\/\/[^/]+\.basemaps\.cartocdn\.com\/.*/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: onePixelPng,
      }),
  );
  await page.route(/https:\/\/lpm\.darkmap\.cn\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: onePixelPng,
    }),
  );
});

test("手动刷新只启动一个云量网格请求并保留已有画布", async ({ page }) => {
  // Delay same-origin forecast responses enough to expose the former
  // cloudGrid=null -> effect rerun -> abort/restart race.
  await page.route("**/api/forecast?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fallback();
  });

  let gridRefreshRequests = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (
      url.pathname === "/api/forecast" &&
      url.searchParams.get("refresh") === "1" &&
      (url.searchParams.get("latitude") ?? "").includes(",")
    ) {
      gridRefreshRequests += 1;
    }
  });

  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&model=gfs&view=combined&overlay=forecast-cloud",
  );
  const canvas = page.locator(".cloud-canvas-overlay canvas");
  await expect(canvas).toBeVisible({ timeout: 15000 });

  await page
    .getByRole("button", {
      name: "强制刷新天气、卫星目录和数据源状态",
    })
    .click();

  // A compatible grid stays on screen while its replacement is in flight.
  await expect(canvas).toBeVisible();
  await expect
    .poll(() => gridRefreshRequests, { timeout: 5000 })
    .toBe(1);
  await page.waitForTimeout(900);
  expect(gridRefreshRequests).toBe(1);
  await expect(page.locator(".cloud-overlay-error")).toHaveCount(0);
});

test("光污染瓦片不强制要求 CORS 响应头", async ({ page }) => {
  await page.goto("/");
  await page
    .getByLabel("地图模式")
    .getByRole("tab", { name: "光污染" })
    .click();

  const map = page.locator(".map-viewport");
  await expect(map).toHaveAttribute(
    "data-observing-viirs-status",
    "available",
    { timeout: 15000 },
  );
  const tile = page.locator('img.leaflet-tile[src*="darkmap.cn"]').first();
  await expect(tile).toBeVisible({ timeout: 15000 });
  expect(await tile.getAttribute("crossorigin")).toBeNull();
});
