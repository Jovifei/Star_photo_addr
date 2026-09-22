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
});
