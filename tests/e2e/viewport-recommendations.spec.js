import { test, expect } from "@playwright/test";
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
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
  await page.route(/https:\/\/lpm\.darkmap\.cn\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
});

test("放大地图后生成编号推荐并可打开现有地点详情", async ({ page }, testInfo) => {
  await page.goto(
    "/?lat=30.2741&lng=120.1551&name=%E6%9D%AD%E5%B7%9E&model=gfs&view=combined&overlay=forecast-cloud",
  );
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByTestId("observation-reason-card")).toBeAttached();

  if (testInfo.project.name === "mobile") {
    const drawer = page.getByTestId("mobile-map-panel-drawer");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
    await page.getByRole("button", { name: "收起观测详情" }).first().click();
    await expect(drawer).toHaveAttribute("aria-hidden", "true");
  }

  const docked = await openMobileMapPanel(page, "recommendations");
  if (!docked) {
    await page.getByRole("tab", { name: "推荐" }).click();
  }
  const generate = page.getByRole("button", { name: "生成区域推荐" });
  await expect(generate).toBeEnabled({ timeout: 15000 });
  await generate.click();

  const firstCard = page.locator(".viewport-recommendation-card").first();
  await expect(firstCard).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".viewport-rank-marker-dot").first()).toHaveText("1");

  await firstCard.click();
  await expect(page.getByTestId("observation-reason-card")).toBeVisible();
});
