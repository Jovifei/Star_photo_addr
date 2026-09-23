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
  await page.getByRole("tab", { name: "图层与偏好", exact: true }).click();
  const bars = page.locator(".cloud-mode-tabs button");
  await expect(bars).toHaveCount(4);
  await expect(bars.first()).toHaveCSS("display", "grid");
});

test("data source label and degraded status remain on the same row", async ({page}) => {
  await page.route('**/api/data-status**', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    status:'degraded', checkedAt:new Date().toISOString(), sources:{weather:{id:'weather',label:'Open-Meteo 云量',status:'degraded',detail:'provider 429'}},
  })}));
  await page.goto('/');
  await openMobileMapPanel(page,'cloud');
  const row=page.locator('.source-status-row[data-status="degraded"]').first();
  await expect(row).toContainText('Open-Meteo 云量');
  await expect(row).toContainText('降级');
  const delta=await row.evaluate(el=>{
    const label=el.querySelector('span')!.getBoundingClientRect();
    const status=el.querySelector('b')!.getBoundingClientRect();
    return Math.abs((label.y + label.height / 2) - (status.y + status.height / 2));
  });
  expect(delta).toBeLessThan(2);
});

test("暗夜选址与今夜观测使用不同的任务说明", async ({ page }) => {
  await page.goto("/sites");
  await expect(page).toHaveURL(/panel=sites/);
  const headline = page.locator('.map-headline[data-workspace="sites"]');
  await expect(headline).toContainText("暗夜选址");
  await expect(headline).toContainText("长期暗空本底");
  await expect(page.getByRole("link", { name: /暗夜选址/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("当前位置没有设备海拔时显示待核验，不借用邻近点位高程", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 30.4012, longitude: 119.2554 });
  await page.goto("/");
  await page.getByRole("button", { name: "使用我的当前位置" }).click();
  const coordinates = page.locator(".panel-coords").first();
  await expect(coordinates).toContainText("海拔待核验");
  await expect(coordinates).not.toContainText(/海拔\s*0\s*m/);
});

test("未安装本地暗夜栅格时给出明确说明而不是含糊无数据", async ({ page }, testInfo) => {
  await page.goto(
    "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4",
  );
  const drawer = page.getByTestId("mobile-map-panel-drawer");
  if (testInfo.project.name === "mobile") {
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
  }
  const darkSkyNote = page.locator(".dark-sky-unavailable-note");
  await expect(darkSkyNote).toContainText(
    "本地暗夜数据未随仓库分发",
    { timeout: 15000 },
  );
  await expect(darkSkyNote).toContainText(
    "不会根据坐标、海拔或点位目录推算 Bortle/SQM",
  );
  await expect(darkSkyNote).not.toContainText("卫星夜光及地理模型估算值");
  if (testInfo.project.name === "mobile") {
    await openMobileMapPanel(page, "layers");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");
  } else {
    await page.getByRole("tab", { name: "图层与偏好" }).click();
  }
  await expect(page.locator(".bortle-control")).toContainText("未安装");
  const helpButton = testInfo.project.name === "mobile"
    ? drawer.getByRole("button", { name: "Bortle、SQM 与未安装说明" })
    : page.locator(".bortle-control:visible").getByRole("button", { name: "Bortle、SQM 与未安装说明" });
  await helpButton.click();
  const dialog = page.getByRole("dialog", { name: "Bortle、SQM 与夜光参考" });
  await expect(dialog).toContainText("有意的安全降级");
  await expect(dialog).toContainText("docs/DARK_SKY_DATA_SETUP.md");
});

test("观星计划兼容链接转入统一工作台并保留地点上下文", async ({ page }, testInfo) => {
  const night = shanghaiDateKey();
  await page.goto(
    `/planner?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&elevation=958.4&night=${night}&model=icon`,
  );
  await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  const target = new URL(page.url());
  expect(target.searchParams.get("lat")).toBe("30.4694");
  expect(target.searchParams.get("lng")).toBe("119.5978");
  if (testInfo.project.name === "mobile") {
    await expect(page.getByTestId("mobile-map-panel-dock")).toBeVisible();
  } else {
    await expect(page.getByTestId("workspace-inspector")).toBeVisible();
  }
  await expect.poll(() => new URL(page.url()).searchParams.get("night")).toBeNull();
});
