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

test("desktop inspector can be resized without sacrificing readable evidence copy", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "证据栏尺寸只测桌面");
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  const inspector = page.getByTestId("workspace-inspector");
  const canvas = page.getByTestId("workspace-canvas");
  const rail = page.getByTestId("workspace-inspector-resizer");
  const standard = page.getByRole("button", { name: "证据栏标准宽度" });
  const wide = page.getByRole("button", { name: "证据栏加宽" });
  await expect(rail).toBeVisible();
  await expect(standard).toBeVisible();
  await expect(wide).toBeVisible();
  await expect(rail).toHaveAttribute("aria-valuenow", "360");
  const before = await inspector.boundingBox();
  const canvasBefore = await canvas.boundingBox();
  expect(before).not.toBeNull();
  expect(canvasBefore).not.toBeNull();

  await wide.click();
  await expect(rail).toHaveAttribute("aria-valuenow", "480");
  const widened = await inspector.boundingBox();
  const canvasAfter = await canvas.boundingBox();
  expect(widened).not.toBeNull();
  expect(canvasAfter).not.toBeNull();
  expect(widened!.width).toBeGreaterThan(before!.width);
  expect(canvasAfter!.width).toBeLessThan(canvasBefore!.width);

  await rail.focus();
  await rail.press("ArrowRight");
  await expect(rail).toHaveAttribute("aria-valuenow", "464");
  await standard.click();
  await expect(rail).toHaveAttribute("aria-valuenow", "360");

  const railBeforeDrag = await rail.boundingBox();
  expect(railBeforeDrag).not.toBeNull();
  await page.mouse.move(
    railBeforeDrag!.x + railBeforeDrag!.width / 2,
    railBeforeDrag!.y + railBeforeDrag!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    railBeforeDrag!.x + railBeforeDrag!.width / 2 - 64,
    railBeforeDrag!.y + railBeforeDrag!.height / 2,
  );
  await page.mouse.up();
  await expect(rail).toHaveAttribute("aria-valuenow", "424");

  const railBeforeNarrowing = await rail.boundingBox();
  expect(railBeforeNarrowing).not.toBeNull();
  await page.mouse.move(
    railBeforeNarrowing!.x + railBeforeNarrowing!.width / 2,
    railBeforeNarrowing!.y + railBeforeNarrowing!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    railBeforeNarrowing!.x + railBeforeNarrowing!.width / 2 + 64,
    railBeforeNarrowing!.y + railBeforeNarrowing!.height / 2,
  );
  await page.mouse.up();
  await expect(rail).toHaveAttribute("aria-valuenow", "360");

  const riskCopy = page.getByTestId("observation-reason-card").locator("dd").nth(1);
  const typography = await riskCopy.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { fontSize: Number.parseFloat(styles.fontSize), lineHeight: Number.parseFloat(styles.lineHeight) };
  });
  expect(typography.fontSize).toBeGreaterThanOrEqual(16);
  expect(typography.lineHeight).toBeGreaterThanOrEqual(24);
});

test("a new location raises the hourly forecast even after a saved collapse", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "时间轴提升交互先测桌面");
  await page.addInitScript(() => {
    localStorage.setItem("perseids-cloud-timeline-expand-v1", "0");
  });
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  const lift = page.getByRole("button", { name: /逐小时预报/ });
  await expect(lift).toBeVisible({ timeout: 20000 });
  await expect(lift).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#hourly-forecast-panel")).toBeVisible();
});

test("mobile forecast lift remains fully above the timeline instead of behind the drawer", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "手机把手几何只测移动端");
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  const lift = page.getByRole("button", { name: /逐小时预报/ });
  const timeline = page.locator(".cloud-timeline");
  await expect(lift).toHaveAttribute("aria-expanded", "true");
  const liftBox = await lift.boundingBox();
  const timelineBox = await timeline.boundingBox();
  expect(liftBox).not.toBeNull();
  expect(timelineBox).not.toBeNull();
  expect(liftBox!.y).toBeGreaterThanOrEqual(timelineBox!.y);
});

test("static night-light reference does not masquerade as an expanded hourly forecast", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "静态参考语义先测桌面");
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&overlay=night-lights");
  await expect(page.locator(".cloud-timeline")).toHaveClass(/is-collapsed/);
  await expect(page.getByRole("button", { name: /逐小时预报/ })).toHaveCount(0);
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
