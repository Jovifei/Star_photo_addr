import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);

const DATE = "2026-08-06";
const QA_DIR = resolve(process.cwd(), "docs/qa");
mkdirSync(QA_DIR, { recursive: true });

function vp(page) {
  return (page.viewportSize()?.width ?? 1280) < 768 ? "mobile" : "desktop";
}
function navScope(page) {
  return vp(page) === "mobile" ? ".mobile-nav" : ".desktop-nav";
}
function navButton(page, label) {
  return page.locator(`${navScope(page)} button`, { hasText: label });
}
async function shot(page, name) {
  await page.screenshot({
    path: resolve(QA_DIR, `${DATE}-${vp(page)}-${name}.jpg`),
    type: "jpeg",
    quality: 72,
  });
}

test.beforeEach(async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  const failedExternal = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const t = msg.text();
    // Browser-generated noise for intentionally aborted/failed network requests
    // (e.g. "Failed to load resource: net::ERR_FAILED"). Not an app defect.
    if (t.startsWith("Failed to load resource")) return;
    consoleErrors.push(t);
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));
  page.on("requestfailed", (req) => {
    const u = req.url();
    if (u.includes("localhost") || u.includes("api.open-meteo.com")) return;
    failedExternal.push(u);
  });
  await installOpenMeteoMock(page, fixture);
  page.__qa = { consoleErrors, pageErrors, failedExternal };
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== "passed") return; // screenshots on failure handled by config
  const { consoleErrors, pageErrors, failedExternal } = page.__qa;
  expect(pageErrors, `pageErrors: ${pageErrors.join(" | ")}`).toEqual([]);
  expect(consoleErrors, `consoleErrors: ${consoleErrors.join(" | ")}`).toEqual([]);
  expect(failedExternal, `failedExternal: ${failedExternal.join(" | ")}`).toEqual([]);
});

test("homepage renders with rankings and no white screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  await expect(page.locator("h1")).toHaveText("星野决策");
  await shot(page, "dashboard");
});

test("7天 / 14天 toggle switches active range", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  const btn14 = page.getByRole("button", { name: "14 天" });
  const btn7 = page.getByRole("button", { name: "7 天" });
  await btn14.click();
  await expect(btn14).toHaveClass(/active/);
  await btn7.click();
  await expect(btn7).toHaveClass(/active/);
});

test("星空 / 云海 mode toggle switches active and labels", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  const cloud = page.locator(".mode-switch button", { hasText: "云海" });
  await cloud.click();
  await expect(cloud).toHaveClass(/active/);
  await expect(page.getByText("点位云海潜力")).toBeVisible();
  await shot(page, "cloud-mode");
  const star = page.locator(".mode-switch button", { hasText: "星空" });
  await star.click();
  await expect(star).toHaveClass(/active/);
});

test("navigation between 今晚 / 对比 / 点位", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  await navButton(page, "对比").click();
  await expect(page.locator(".matrix-section")).toBeVisible();
  await shot(page, "matrix");
  await navButton(page, "点位").click();
  await expect(page.locator(".locations-section")).toBeVisible();
  await navButton(page, "今晚").click();
  await expect(page.locator(".rank-card").first()).toBeVisible();
});

test("observation night switching updates selection", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  const rail = page.locator(".night-rail button");
  const count = await rail.count();
  expect(count).toBeGreaterThan(1);
  await rail.nth(1).click();
  await expect(rail.nth(1)).toHaveClass(/active/);
});

test("detail drawer opens, Esc closes, body scroll locked", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  await page.locator(".rank-card").first().click();
  const drawer = page.locator(".detail-drawer");
  await expect(drawer).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".drawer-backdrop")).toBeVisible();
  const overflowOpen = await page.evaluate(() => document.body.style.overflow);
  expect(overflowOpen).toBe("hidden");
  await shot(page, "drawer");
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden({ timeout: 10000 });
  const overflowClosed = await page.evaluate(() => document.body.style.overflow);
  expect(overflowClosed).not.toBe("hidden");
});

test("detail drawer opens from matrix cell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  await navButton(page, "对比").click();
  await expect(page.locator(".matrix-cell").first()).toBeVisible({ timeout: 10000 });
  await page.locator(".matrix-cell").first().click();
  await expect(page.locator(".detail-drawer")).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");
  await expect(page.locator(".detail-drawer")).toBeHidden({ timeout: 10000 });
});

test("custom location form validates empty and saves valid", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  await navButton(page, "点位").click();
  await expect(page.locator(".locations-section")).toBeVisible();
  const rowsBefore = await page.locator(".location-table tbody tr").count();

  await page.getByRole("button", { name: "新增点位" }).click();
  await expect(page.locator(".location-form")).toBeVisible();
  await shot(page, "location-form");
  // empty submit must be blocked
  await page.getByRole("button", { name: "保存点位" }).click();
  await expect(page.locator(".location-form")).toBeVisible();
  expect(await page.locator(".location-table tbody tr").count()).toBe(rowsBefore);

  // valid submit
  await page.getByPlaceholder("例如：东白山").fill("测试山");
  await page.getByPlaceholder("29.5000").fill("29.5");
  await page.getByPlaceholder("120.3000").fill("120.3");
  await page.getByPlaceholder("1000").fill("1000");
  await page.getByRole("button", { name: "保存点位" }).click();
  await expect(page.locator(".status-banner")).toContainText("新点位已保存到本机");
  const rowsAfter = await page.locator(".location-table tbody tr").count();
  expect(rowsAfter).toBe(rowsBefore + 1);
});

test("API failure shows error banner and preserves prior data", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  // override mock to abort; last-registered route wins
  await page.route("**/api.open-meteo.com/v1/forecast**", (route) => route.abort());
  await page.locator(".refresh-button").click();
  await expect(page.locator(".status-banner")).toContainText("已保留上一次成功数据", {
    timeout: 10000,
  });
  await expect(page.locator(".rank-card").first()).toBeVisible();
  await shot(page, "api-failure");
});
