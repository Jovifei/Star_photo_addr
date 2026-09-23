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

  await page.getByRole("button", { name: /展开观测详情/ }).click();
  await expect(drawer).toHaveAttribute("aria-hidden", "false");

  const initialLayout = await drawer.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const body = element.querySelector<HTMLElement>(".mobile-map-panel-body");
    const close = element.querySelector<HTMLButtonElement>(
      'button[aria-label="关闭地图工具侧边栏"]',
    );
    const restore = element.parentElement?.querySelector<HTMLElement>(
      ":scope > .detail-restore",
    );
    const restoreStyle = restore ? getComputedStyle(restore) : null;
    const closeRect = close?.getBoundingClientRect();
    return {
      x: rect.x,
      width: rect.width,
      viewportWidth: window.innerWidth,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : "",
      bodyOverflowX: body ? body.scrollWidth - body.clientWidth : 0,
      restoreVisible: Boolean(
        restore &&
          restoreStyle?.display !== "none" &&
          restore.getBoundingClientRect().width > 0,
      ),
      closeWidth: closeRect?.width ?? 0,
      closeHeight: closeRect?.height ?? 0,
    };
  });
  expect(initialLayout.x).toBeGreaterThanOrEqual(-0.5);
  expect(initialLayout.width).toBeCloseTo(initialLayout.viewportWidth, 0);
  expect(initialLayout.bodyOverflowY).toMatch(/auto|scroll/);
  expect(initialLayout.bodyOverflowX).toBeLessThanOrEqual(1);
  expect(initialLayout.restoreVisible).toBe(false);
  expect(initialLayout.closeWidth).toBeGreaterThanOrEqual(48);
  expect(initialLayout.closeHeight).toBeGreaterThanOrEqual(48);

  await drawer.getByRole("button", { name: "关闭地图工具侧边栏" }).click();
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

  const drawerBox = await drawer.boundingBox();
  expect(drawerBox).not.toBeNull();
  expect(drawerBox!.x).toBeGreaterThanOrEqual(-1);
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(812.5);

  const layout = await drawer.evaluate((element) => {
    const drawerRect = element.getBoundingClientRect();
    const body = element.querySelector<HTMLElement>(".mobile-map-panel-body");
    const childrenFitHorizontally = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".map-layer-bar, .map-view-actions, .map-legend, .map-boundary-status",
      ),
    ).every((child) => {
      const rect = child.getBoundingClientRect();
      return (
        rect.left >= drawerRect.left - 1 &&
        rect.right <= drawerRect.right + 1
      );
    });
    return {
      childrenFitHorizontally,
      bodyOverflowY: body ? getComputedStyle(body).overflowY : "",
      bodyIsScrollable: Boolean(body && body.scrollHeight > body.clientHeight),
    };
  });
  expect(layout.childrenFitHorizontally).toBe(true);
  expect(layout.bodyOverflowY).toMatch(/auto|scroll/);
  expect(layout.bodyIsScrollable).toBe(true);
});

test("桌面端在证据页签中打开云量和地点，而不是地图浮层", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "仅验证桌面布局");
  await page.goto("/?overlay=forecast-cloud&view=combined");

  await expect(page.getByTestId("mobile-map-panel-dock")).toHaveCount(0);
  await page.getByRole("tab", { name: "图层与偏好" }).click();
  await expect(page.locator(".cloud-control")).toBeVisible();
  await page.getByRole("tab", { name: "图层与偏好" }).click();
  await expect(page.locator(".observing-map-control")).toBeVisible();
});
