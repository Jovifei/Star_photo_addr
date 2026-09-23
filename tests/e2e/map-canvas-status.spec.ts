import { expect, test } from "@playwright/test";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
import { readFileSync } from "node:fs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("failed map tiles can be retried and clear only after successful loads", async ({page}) => {
  let fail = true;
  let recovered = 0;
  await page.route('https://tile.openstreetmap.org/**', route => {
    if(fail) return route.fulfill({status:503,body:'offline'});
    recovered++;
    return route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')});
  });
  await page.route('https://lpm.darkmap.cn/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')}));
  await page.goto('/');
  await expect(page.locator('.map-tile-error')).toBeVisible();
  // A retry which still fails must not permanently dismiss the error.
  await page.getByRole('button',{name:'重试地图图层'}).click();
  await expect(page.locator('.map-tile-error')).toBeVisible();
  const drawer = page.getByTestId('mobile-map-panel-drawer');
  if(await drawer.count()) await expect(drawer).toHaveAttribute('aria-hidden','true');
  fail = false;
  await page.getByRole('button',{name:'重试地图图层'}).click();
  await expect.poll(()=>recovered).toBeGreaterThan(0);
  await expect(page.locator('.map-tile-error')).toHaveCount(0);
});

test("地图底图 tile 失败和天气网格失败分别显示原因", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "画布失败状态在手机 Chromium 验证一次");
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) =>
    route.fulfill({ status: 503, contentType: "text/plain", body: "tile unavailable" }),
  );
  await page.route("**/api/forecast**", (route) =>
    route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "天气网格接口 HTTP 502" }) }),
  );
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await expect(page.locator(".map-tile-error")).toContainText("地图底图或图层加载失败", { timeout: 15000 });
  await expect(page.locator(".cloud-overlay-error")).toContainText("云图加载失败", { timeout: 15000 });
  await expect(page.locator(".cloud-overlay-error")).toContainText("强制重试");
  await page.goto('/?lat=30.2741&lng=120.1551&name=Hangzhou');
  await expect(page.getByRole('img',{name:'星空分：暂无评分'})).toBeVisible();
});
