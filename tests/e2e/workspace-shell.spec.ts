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

test("desktop shell keeps search off the map and inspector in flow", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "三栏几何只测桌面");
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await expect(page.getByTestId("workspace-shell")).toBeVisible();
  await expect(page.getByTestId("workspace-input")).toBeVisible();
  await expect(page.getByTestId("workspace-inspector")).toBeVisible();
  const searchBox = await page.getByTestId("workspace-input").boundingBox();
  const mapBox = await page.locator(".leaflet-container").first().boundingBox();
  expect(searchBox).not.toBeNull();
  expect(mapBox).not.toBeNull();
  expect(searchBox!.x + searchBox!.width).toBeLessThanOrEqual(mapBox!.x + 8);
  await expect(page.locator(".map-viewport .map-search-card")).toHaveCount(0);
  await expect(page.locator(".map-viewport .cloud-control")).toHaveCount(0);
  await expect(page.locator(".nearby-ranking-panel")).toHaveCount(0);
});

test("desktop inspector lazily mounts inactive evidence panes", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "证据页懒挂载只测桌面");
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await expect(page.getByRole("tabpanel", { name: "摘要" })).toBeVisible();
  await expect(
    page.getByRole("tabpanel", { name: "推荐", includeHidden: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "推荐" }).click();
  await expect(page.getByRole("tabpanel", { name: "推荐" })).toBeVisible();
});

test("desktop inspector arrow keys move selection and keyboard focus", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "证据页键盘行为只测桌面");
  await page.goto("/?overlay=forecast-cloud&view=combined");
  const summaryTab = page.getByRole("tab", { name: "摘要" });
  const placesTab = page.getByRole("tab", { name: "地点" });
  await summaryTab.focus();
  await summaryTab.press("ArrowRight");
  await expect(placesTab).toHaveAttribute("aria-selected", "true");
  await expect(placesTab).toBeFocused();
  await placesTab.press("ArrowLeft");
  await expect(summaryTab).toHaveAttribute("aria-selected", "true");
  await expect(summaryTab).toBeFocused();
});

test("sampling a point updates summary without a covering overlay", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "桌面不再盖住地图");
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  const summary = page.getByTestId("observation-reason-card");
  await expect(summary).toBeVisible({ timeout: 20000 });
  await expect(summary).toContainText("天荒坪");
  await expect(summary).not.toContainText("无主要安全门禁");
  await expect(page.locator(".detail-overlay-host.is-open")).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("planner map clips Leaflet tiles when entered directly", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "规划地图几何只测桌面");
  await page.goto("/planner");
  await page.getByRole("button", { name: "地图", exact: true }).click();
  const map = page.locator(".observation-map");
  await expect(map).toBeVisible();
  await expect(map).toHaveCSS("overflow", "hidden");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test("mobile still uses one drawer and can open summary from the map dock", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "手机单抽屉");
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await expect(page.getByTestId("mobile-map-panel-dock")).toBeVisible();
  await expect(page.locator(".cloud-control")).toHaveCount(0);
  await page.getByTestId("mobile-map-panel-open-cloud").click();
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  await expect(drawer).toHaveAttribute("aria-hidden", "false");
  await expect(drawer.locator(".cloud-control")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveAttribute("aria-hidden", "true");
});
