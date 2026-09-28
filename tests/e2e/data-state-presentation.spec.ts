import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  buildNormalizedForecasts,
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";
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
