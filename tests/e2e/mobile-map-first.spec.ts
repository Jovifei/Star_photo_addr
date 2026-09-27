import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { installNextApiMock, installOpenMeteoMock, installGeocodingMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await installNextApiMock(page, fixture);
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
});

const mapCenter = (page: Page) => page.locator(".leaflet-container").first().getAttribute("data-map-center");
const mapZoom = async (page: Page) => Number(await page.locator(".leaflet-container").first().getAttribute("data-map-zoom"));

for (const width of [320, 375, 390, 430, 768, 1024]) {
  test(`map-first geometry and three-state sheet at ${width}px`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "compact matrix executes once");
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const map = page.locator(".map-viewport");
    const sheet = page.getByTestId("mobile-data-sheet");
    await expect(map).toBeVisible();
    await expect(sheet).toHaveAttribute("data-level", "peek");
    const nav = page.getByRole("navigation", { name: "页面导航" });
    const navBox = await nav.boundingBox();
    expect(navBox!.y + navBox!.height).toBeGreaterThanOrEqual(843);
    const top = (await page.locator(".workspace-commandbar").boundingBox())!.y +
      (await page.locator(".workspace-commandbar").boundingBox())!.height;
    expect(top).toBeLessThanOrEqual(112);
    if (width === 390) expect((await map.boundingBox())!.height).toBeGreaterThanOrEqual(422);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await expect(sheet).toHaveAttribute("data-level", "half");
    await page.getByRole("button", { name: "展开数据面板" }).click();
    await expect(sheet).toHaveAttribute("data-level", "full");
    await expect(sheet.getByRole("button", { name: "收起数据面板" })).toBeFocused();
    await expect(sheet.getByTestId("mobile-data-sheet-body")).toBeVisible();
    await page.getByRole("button", { name: "收起数据面板" }).click();
    await page.getByRole("button", { name: "收起数据面板" }).click();
    await expect(sheet).toHaveAttribute("data-level", "peek");
    await expect(sheet.getByRole("button", { name: "展开数据面板" })).toBeFocused();
    if (width < 960) {
      const handle = sheet.getByRole("separator", { name: "拖动调整数据面板高度" });
      await handle.focus();
      await page.keyboard.press("ArrowUp");
      await expect(sheet).toHaveAttribute("data-level", "half");
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveAttribute("data-level", "peek");
    }
  });
}

for (const route of ["/", "/sites", "/fireglow", "/cloudsea"]) {
  test(`${route}: map defaults to pan and zoom without mode toggle`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "touch matrix executes once");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route);
    const map = page.locator(".leaflet-container").first();
    await expect(map).toHaveAttribute("data-map-zoom", /\d+/);
    await expect(page.getByRole("button", { name: /移动地图/ })).toHaveCount(0);
    const initialZoom = await mapZoom(page);
    await page.locator(".leaflet-control-zoom-in").first().click();
    await expect.poll(() => mapZoom(page)).toBe(initialZoom + 1);
    await page.locator(".leaflet-control-zoom-out").first().click();
    await expect.poll(() => mapZoom(page)).toBe(initialZoom);

    const initialCenter = await mapCenter(page);
    const box = (await map.boundingBox())!;
    const x = box.x + Math.min(100, box.width * .25);
    const y = box.y + box.height * .38;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x, y }] });
    for (let n = 1; n <= 6; n++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: x + n * 13, y: y + n * 8 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => mapCenter(page)).not.toBe(initialCenter);
    await expect(page.getByTestId("mobile-data-sheet")).toHaveAttribute("data-level", "peek");

    const beforePinch = await mapZoom(page);
    const cx = box.x + box.width * .5;
    const cy = box.y + box.height * .48;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [
      { id: 1, x: cx - 22, y: cy }, { id: 2, x: cx + 22, y: cy },
    ] });
    for (let n = 1; n <= 6; n++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
        { id: 1, x: cx - 22 - n * 12, y: cy }, { id: 2, x: cx + 22 + n * 12, y: cy },
      ] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => mapZoom(page)).toBeGreaterThan(beforePinch);
  });
}

test("map and sheet own different touch regions; topic blank tap shows nearby directory sites", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch matrix executes once");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fireglow");
  const sheet = page.getByTestId("mobile-data-sheet");
  const map = page.locator(".leaflet-container").first();
  await expect(map).toHaveAttribute("data-map-zoom", /\d+/);
  const initialCenter = await mapCenter(page);
  const handle = sheet.getByRole("separator", { name: "拖动调整数据面板高度" });
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x, y: y - 80 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toHaveAttribute("data-level", "half");
  expect(await mapCenter(page)).toBe(initialCenter);
  await page.getByRole("button", { name: "收起数据面板" }).click();
  const mapBox = (await map.boundingBox())!;
  await page.touchscreen.tap(mapBox.x + mapBox.width * .3, mapBox.y + mapBox.height * .25);
  await expect(sheet).toHaveAttribute("data-level", "half");
  await expect(sheet.locator(".mobile-data-sheet-location")).toContainText("所点坐标");
  await expect(sheet.getByText(/不代表该坐标的预测/)).toBeVisible();
  expect(await mapCenter(page)).toBe(initialCenter);
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(sheet.locator(".mobile-data-sheet-location")).toContainText("所点坐标");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sheet.locator(".mobile-data-sheet-location")).toContainText("所点坐标");
});

test("home map accepts the first touch immediately after sheet drag and collapse", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch matrix executes once");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const sheet = page.getByTestId("mobile-data-sheet");
  const handle = sheet.getByRole("separator", { name: "拖动调整数据面板高度" });
  const box = (await handle.boundingBox())!;
  const cdp = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x, y: y - 80 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(sheet).toHaveAttribute("data-level", "half");
  await sheet.getByRole("button", { name: "收起数据面板" }).click();
  const map = page.locator(".leaflet-container").first();
  const mapBox = (await map.boundingBox())!;
  await page.touchscreen.tap(mapBox.x + mapBox.width * .24, mapBox.y + mapBox.height * .25);
  await expect(sheet).toHaveAttribute("data-level", "half");
  await expect(sheet.locator(".mobile-data-sheet-location")).not.toHaveText("今夜观测");
});
