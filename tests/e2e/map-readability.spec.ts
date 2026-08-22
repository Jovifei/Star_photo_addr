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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("地图面板支持显示比例调整并将云量通道展示为横向进度条", async ({ page }) => {
  await page.goto("/?overlay=forecast-cloud&view=combined");
  const manager = page.locator(".map-panel-manager");
  const cloudControl = page.locator(".cloud-control");
  await expect(manager).toBeVisible();
  await expect(cloudControl).toBeVisible();
  const scale = page.getByRole("slider", { name: "云量与图层显示比例" });
  await scale.fill("1.2");
  await expect
    .poll(() =>
      cloudControl.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--map-panel-scale").trim(),
      ),
    )
    .toBe("1.2");
  const bars = page.locator(".cloud-mode-tabs button.cloud-channel-bar");
  await expect(bars).toHaveCount(4);
  await expect(bars.first()).toHaveCSS("display", "grid");
});

test("未安装本地暗夜栅格时给出明确说明而不是含糊无数据", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".bortle-control")).toContainText("未安装");
  await page.getByRole("button", { name: "Bortle、SQM 与未安装说明" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("有意的安全降级");
  await expect(dialog).toContainText("docs/DARK_SKY_DATA_SETUP.md");
});

test("观星计划可按 10/50/100/200 公里查看附近排行", async ({ page }) => {
  await page.goto(
    "/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=2026-08-22&model=icon",
  );
  const toggle = page.getByRole("button", { name: /附近排行/ });
  await expect(toggle).toBeVisible({ timeout: 15000 });
  await toggle.click();
  const radius = page.getByRole("combobox", { name: "附近地点排行半径" });
  await expect(radius).toHaveValue("100");
  await radius.selectOption("200");
  await expect(page.locator(".nearby-ranking-list li").first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".nearby-ranking-list")).toContainText("km");
  await expect(page.locator(".nearby-ranking-list")).toContainText("海拔");
});
