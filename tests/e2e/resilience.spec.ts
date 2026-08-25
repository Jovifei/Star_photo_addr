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
  await page.route(/https:\/\/[^/]+\.basemaps\.cartocdn\.com\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
  await page.route(/https:\/\/lpm\.darkmap\.cn\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
});

test("a failed forced cloud refresh keeps the last usable canvas", async ({
  page,
}) => {
  let rejectForcedRefresh = false;
  await page.route("**/api/forecast?**", async (route) => {
    const url = new URL(route.request().url());
    if (rejectForcedRefresh && url.searchParams.get("refresh") === "1") {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "simulated upstream outage" }),
      });
      return;
    }
    await route.fallback();
  });

  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&" +
      "elevation=958.4&model=gfs&view=combined&overlay=forecast-cloud",
  );
  const canvas = page.locator(".cloud-canvas-overlay canvas");
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await openMobileMapPanel(page, "cloud");

  rejectForcedRefresh = true;
  await page
    .getByRole("button", {
      name: "强制刷新天气、卫星目录和数据源状态",
    })
    .click();

  await expect(canvas).toBeVisible();
  await expect(page.locator(".cloud-overlay-error")).toContainText(
    "已保留上一次结果",
    { timeout: 15_000 },
  );
});
