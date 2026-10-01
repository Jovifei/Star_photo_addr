import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  buildNormalizedForecasts,
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
import type { HourWeather } from "@/lib/types";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const selectedUrl = "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&model=icon&overlay=forecast-cloud";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

for (const project of ["mobile", "desktop"] as const) {
  test(`${project}: normal selected data and recommendation axes are explicit`, async ({ page }, info) => {
    test.skip(info.project.name !== project, `${project} data-state contract runs in its project`);
    await page.setViewportSize(project === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto(selectedUrl);
    await expect(page.getByTestId("observation-reason-card")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("selected-data-state")).toContainText("当前数据完整");
    await expect(page.getByTestId("recommendation-eligibility")).toContainText("已通过推荐数据门禁");
    if (project === "mobile") {
      await expect(page.getByTestId("provider-health-scope")).toHaveCount(0);
    }
  });
}

test("HTTP 200 with incomplete scoring fields is partial and withholds recommendation", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "integrity presentation runs once on desktop");
  await page.route("**/api/forecast?**", async (route) => {
    const url = new URL(route.request().url());
    const locations = buildNormalizedForecasts(
      fixture,
      (url.searchParams.get("latitude") ?? "").split(",").filter(Boolean),
      (url.searchParams.get("longitude") ?? "").split(",").filter(Boolean),
      14,
      url.searchParams.get("model") ?? "icon",
    );
    for (const location of locations) {
      location.hourly = location.hourly.map((hour: HourWeather) => ({ ...hour, visibility: null }));
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations, metadata: locations[0]?.metadata }) });
  });
  await page.goto(selectedUrl);
  await expect(page.getByTestId("selected-data-state")).toContainText("数据部分可用", { timeout: 20_000 });
  await expect(page.getByTestId("recommendation-eligibility")).toContainText("不发布推荐");
  await expect(page.locator(".candidate-score-number strong").filter({ hasText: "94" })).toHaveCount(0);
});

test("candidate comparison uses one Best Match batch and preserves ICON facts when visibility blocks scoring", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  await page.addInitScript(() => {
    localStorage.setItem("perseids-custom-candidates-v1", JSON.stringify(Array.from({ length: 6 }, (_, index) => ({
      id: `evidence-candidate-${index}`, name: index === 0 ? "红测点" : `候选点${index + 1}`,
      province: "上海", city: "上海", latitude: 31.6 + index / 10, longitude: 121.3 + index / 10,
      elevation: null, source: "自定义",
    }))));
  });
  const candidateBatchSizes: number[] = [];
  const candidateModels: string[] = [];
  const selectedModels: string[] = [];
  await page.route("**/api/forecast?**", async (route) => {
    const url = new URL(route.request().url());
    const latitudes = (url.searchParams.get("latitude") ?? "").split(",").filter(Boolean);
    const longitudes = (url.searchParams.get("longitude") ?? "").split(",").filter(Boolean);
    const model = url.searchParams.get("model") ?? "icon";
    if (latitudes.includes("31.6")) {
      candidateBatchSizes.push(latitudes.length);
      candidateModels.push(model);
    }
    if (latitudes.length === 1 && latitudes[0] === "30.4694" && longitudes[0] === "119.5978") selectedModels.push(model);
    const locations = buildNormalizedForecasts(
      fixture,
      latitudes,
      longitudes,
      14,
      model,
    );
    for (const location of locations) {
      location.hourly = location.hourly.map((hour: HourWeather) => ({
        ...hour, cloudCover: 35, precipitationProbability: 15, windSpeed: 3.4,
        visibility: model === "icon" ? null : 20_000,
      }));
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations, metadata: locations[0]?.metadata }) });
  });
  await page.goto(selectedUrl);
  if (mobile) await expandMobileDataSheet(page);
  const card = page.locator(mobile ? ".mobile-sheet-candidates .candidate-card" : ".candidate-card").filter({ hasText: "红测点" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect.poll(() => candidateBatchSizes, { timeout: 20_000 }).toEqual([6]);
  await expect.poll(() => candidateModels, { timeout: 20_000 }).toEqual(["best_match"]);
  await expect(card.getByTestId("candidate-provenance")).toContainText("原始抓取：2026-", { timeout: 20_000 });
  await expect.poll(async () => card.locator(".candidate-score-number strong").textContent(), { timeout: 20_000 }).toMatch(/^\d+$/);
  await expect(card.getByTestId("candidate-provenance")).toContainText("最佳匹配");
  const selectedRow = page.locator(".star-window-table tbody tr").first();
  await expect.poll(async () => selectedRow.locator(".cell-score").first().textContent(), { timeout: 20_000 }).toMatch(/^\d+$/);
  await expect.poll(() => selectedModels, { timeout: 20_000 }).toContain("best_match");

  await page.getByRole("combobox", { name: "候选评分模型" }).selectOption("icon");
  await expect.poll(() => candidateModels, { timeout: 20_000 }).toEqual(["best_match", "icon"]);
  await expect.poll(() => candidateBatchSizes).toEqual([6, 6]);
  await expect(card.locator(".candidate-score-number")).toContainText("—");
  await expect(card.locator(".candidate-status-pill")).toContainText("缺能见度");
  await expect(card.locator(".candidate-metrics-row")).toContainText("云量 35%");
  await expect(card.locator(".candidate-metrics-row")).toContainText("降水 15%");
  await expect(card.locator(".candidate-metrics-row")).toContainText("风速 3.4m/s");
  await expect(card.getByTestId("candidate-provenance")).toContainText("ICON");
  await expect.poll(async () => selectedRow.locator(".cell-status").first().textContent(), { timeout: 20_000 }).toContain("缺能见度");
  const tableRow = page.locator(".star-window-table tbody tr").filter({ hasText: "红测点" });
  await expect(tableRow.locator(".cell-status").first()).toContainText("缺能见度");
  await expect(tableRow.locator(".cell-evidence").first()).toContainText("云 35%");
  await page.getByRole("button", { name: "切换到最佳匹配模型重算" }).click();
  await expect.poll(async () => card.locator(".candidate-score-number strong").textContent(), { timeout: 20_000 }).toMatch(/^\d+$/);
  await expect(card.getByTestId("candidate-provenance")).toContainText("最佳匹配");
  await expect.poll(async () => selectedRow.locator(".cell-score").first().textContent(), { timeout: 20_000 }).toMatch(/^\d+$/);
});

test("provider degradation stays separate from selected-data eligibility", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "provider/data axis separation runs once on desktop");
  await page.route("**/api/data-status**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "degraded",
      checkedAt: new Date().toISOString(),
      cached: false,
      sources: {
        weather: { id: "weather", label: "Open-Meteo 云量", status: "degraded", detail: "probe 429", checkedAt: new Date().toISOString() },
        satellite: { id: "satellite", label: "NASA GIBS", status: "available", detail: "ok", checkedAt: new Date().toISOString() },
        "light-pollution": { id: "light-pollution", label: "VIIRS", status: "available", detail: "ok", checkedAt: new Date().toISOString() },
        tianditu: { id: "tianditu", label: "天地图", status: "unconfigured", detail: "optional", checkedAt: new Date().toISOString() },
        "local-dark-sky": { id: "local-dark-sky", label: "Bortle/SQM", status: "not-installed", detail: "optional", checkedAt: new Date().toISOString() },
      },
    }),
  }));
  await page.goto(selectedUrl);
  await expect(page.getByTestId("selected-data-state")).toContainText("当前数据完整", { timeout: 20_000 });
  await expect(page.getByTestId("recommendation-eligibility")).toContainText("已通过推荐数据门禁");
  await page.getByRole("tab", { name: "图层与偏好" }).click();
  await expect(page.getByTestId("provider-health-scope")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.source-status-row[data-status="degraded"]').first()).toContainText("上游检测降级");
  await expect(page.getByTestId("provider-health-scope")).toContainText("上游探测只说明");
});
