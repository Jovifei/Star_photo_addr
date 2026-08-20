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

function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

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

  // ObservingViirsLayer writes status on Leaflet's actual map container, not
  // the outer layout wrapper.
  const map = page.locator(".leaflet-container");
  await expect(map).toHaveAttribute(
    "data-observing-viirs-status",
    "available",
    { timeout: 15000 },
  );
  const tile = page.locator('img.leaflet-tile[src*="darkmap.cn"]').first();
  await expect(tile).toBeVisible({ timeout: 15000 });
  expect(await tile.getAttribute("crossorigin")).toBeNull();
});

test("时间轴播放复用 AQI/Kp 序列，只有手动刷新才重新请求", async ({ page }) => {
  const date = shanghaiDateKey();
  const start = Date.parse(`${date}T00:00:00Z`);
  const airUrls = [];
  const kpUrls = [];

  await page.route("**/api/air-quality?**", async (route) => {
    airUrls.push(route.request().url());
    const hourly = Array.from({ length: 96 }, (_, index) => ({
      time: new Date(start + index * 3_600_000).toISOString().slice(0, 16),
      usAqi: 30 + (index % 20),
      pm2_5: 8,
      pm10: 12,
      ozone: 20,
      nitrogenDioxide: 5,
      sulphurDioxide: 2,
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hourly }),
    });
  });
  await page.route("**/api/space-weather/kp**", async (route) => {
    kpUrls.push(route.request().url());
    const frames = Array.from({ length: 32 }, (_, index) => ({
      time: new Date(start - 8 * 3_600_000 + index * 3 * 3_600_000)
        .toISOString()
        .replace("T", " ")
        .replace("Z", ""),
      kp: 2 + (index % 4),
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ frames }),
    });
  });

  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&model=gfs&view=combined&overlay=forecast-cloud",
  );
  await expect.poll(() => airUrls.length, { timeout: 15000 }).toBe(1);
  await expect.poll(() => kpUrls.length, { timeout: 15000 }).toBe(1);

  const timeline = page.locator(".cloud-timeline");
  await timeline.getByRole("button", { name: "播放" }).click();
  await page.waitForTimeout(3500);
  await timeline.getByRole("button", { name: "暂停" }).click();
  expect(airUrls).toHaveLength(1);
  expect(kpUrls).toHaveLength(1);

  const refresh = page.getByRole("button", {
    name: "强制刷新天气、卫星目录和数据源状态",
  });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  await expect.poll(() => airUrls.length, { timeout: 10000 }).toBe(2);
  await expect.poll(() => kpUrls.length, { timeout: 10000 }).toBe(2);
  expect(new URL(airUrls.at(-1)).searchParams.get("refresh")).toBe("1");
  expect(new URL(kpUrls.at(-1)).searchParams.get("refresh")).toBe("1");
});
