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

function shanghaiDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("云量通道展示为横向进度条", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "移动端改用单一侧边栏");
  await page.goto("/?overlay=forecast-cloud&view=combined");
  await page.getByRole("tab", { name: "云量", exact: true }).click();
  const bars = page.locator(".cloud-mode-tabs button");
  await expect(bars).toHaveCount(4);
  await expect(bars.first()).toHaveCSS("display", "grid");
});

test("暗夜选址与今夜观测使用不同的任务说明", async ({ page }) => {
  await page.goto("/sites");
  await expect(page).toHaveURL(/panel=sites/);
  const headline = page.locator('.map-headline[data-workspace="sites"]');
  await expect(headline).toContainText("寻找更暗的长期机位");
  await expect(headline).toContainText("先比较暗夜本底");
  await expect(page.getByRole("link", { name: /暗夜选址/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("未安装本地暗夜栅格时给出明确说明而不是含糊无数据", async ({ page }, testInfo) => {
  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  if (testInfo.project.name === "mobile") {
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
  }
  await expect(page.locator(".dark-sky-unavailable-note")).toContainText(
    "本地 Bortle/SQM 数值栅格",
    { timeout: 15000 },
  );
  const metricValues = page.locator(".metric-grid .metric .value");
  await expect(metricValues.first()).toContainText("未安装");
  if (testInfo.project.name === "mobile") {
    await openMobileMapPanel(page, "layers");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
  } else {
    await page.getByRole("tab", { name: "地点" }).click();
  }
  await expect(page.locator(".bortle-control")).toContainText("未安装");
  const helpButton = testInfo.project.name === "mobile"
    ? drawer.getByRole("button", { name: "Bortle、SQM 与未安装说明" })
    : page.locator(".bortle-control:visible").getByRole("button", { name: "Bortle、SQM 与未安装说明" });
  await helpButton.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("有意的安全降级");
  await expect(dialog).toContainText("docs/DARK_SKY_DATA_SETUP.md");
});

test("观星计划使用单一内嵌附近推荐，支持 10/50/100/200 公里", async ({ page }) => {
  const night = shanghaiDateKey();
  await page.goto(
    `/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=${night}&model=icon`,
  );
  const nearby = page.locator('[aria-label="附近观星点推荐范围"]');
  await expect(nearby).toBeVisible({ timeout: 15000 });
  await expect(nearby.getByRole("button", { name: "10 km" })).toBeVisible();
  await expect(nearby.getByRole("button", { name: "50 km" })).toBeVisible();
  await expect(nearby.getByRole("button", { name: "100 km" })).toBeVisible();
  await expect(nearby.getByRole("button", { name: "200 km" })).toBeVisible();
  await expect(page.locator(".nearby-ranking-panel")).toHaveCount(0);
  await nearby.getByRole("button", { name: "200 km" }).click();
  await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
});
