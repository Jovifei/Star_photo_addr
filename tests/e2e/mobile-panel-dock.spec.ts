import { expect, test } from "@playwright/test";
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

test("手机端将地图面板收纳进侧边栏且一次只显示一个工具", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "仅验证手机端侧边栏");

  await page.goto("/?overlay=forecast-cloud&view=combined");
  const dock = page.getByTestId("mobile-map-panel-dock");
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  await expect(dock).toBeVisible();
  await expect(drawer).toHaveAttribute("aria-hidden", "true");

  await page.getByTestId("mobile-map-panel-open-cloud").click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(drawer.locator(".cloud-control")).toBeVisible();
  await expect(drawer.locator(".observing-map-control")).toBeHidden();

  const drawerBox = await drawer.boundingBox();
  expect(drawerBox).not.toBeNull();
  expect(drawerBox!.x).toBeGreaterThanOrEqual(0);
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(375.5);

  await drawer.getByRole("tab", { name: "地点" }).click();
  await expect(drawer.locator(".observing-map-control")).toBeVisible();
  await expect(drawer.locator(".cloud-control")).toBeHidden();
  await expect(drawer.locator(".observing-map-control")).toHaveAttribute(
    "data-docked",
    "true",
  );

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByTestId("mobile-map-panel-open-cloud")).toBeFocused();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("手机横屏仍使用侧边栏而不是恢复重叠的桌面浮窗", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "仅验证手机横屏断点");
  await page.setViewportSize({ width: 812, height: 375 });
  await page.goto("/?overlay=forecast-cloud&view=combined");

  await expect(page.getByTestId("mobile-map-panel-dock")).toBeVisible();
  await page.getByTestId("mobile-map-panel-open-layers").click();
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  await expect(drawer.locator(".map-layer-bar")).toBeVisible();
  await expect(drawer.locator(".map-view-actions")).toBeVisible();
  await expect(drawer.locator(".map-legend")).toBeVisible();

  const contained = await drawer.evaluate((element) => {
    const drawerRect = element.getBoundingClientRect();
    return Array.from(
      element.querySelectorAll<HTMLElement>(
        ".map-layer-bar, .map-view-actions, .map-legend, .map-boundary-status",
      ),
    ).every((child) => {
      const rect = child.getBoundingClientRect();
      return (
        rect.left >= drawerRect.left - 1 &&
        rect.right <= drawerRect.right + 1 &&
        rect.top >= drawerRect.top - 1 &&
        rect.bottom <= drawerRect.bottom + 1
      );
    });
  });
  expect(contained).toBe(true);
});

test("桌面端保留原有浮动和可拖动面板", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "仅验证桌面布局");
  await page.goto("/?overlay=forecast-cloud&view=combined");

  await expect(page.getByTestId("mobile-map-panel-dock")).toHaveCount(0);
  await expect(page.locator(".cloud-control")).toBeVisible();
  await expect(page.locator(".observing-map-control")).toBeVisible();
  await expect(page.locator(".map-panel-manager")).toBeVisible();
});
