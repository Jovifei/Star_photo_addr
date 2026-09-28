import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildNormalizedForecasts, installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
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

test("CloudTimeline maps complete hourly facts to ready", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "timeline state runs once on desktop");
  await page.goto(selectedUrl);
  await expect(page.getByTestId("hourly-data-validity")).toHaveAttribute("data-state", "ready", { timeout: 20_000 });
  await expect(page.getByTestId("hourly-data-validity")).toContainText("当前数据完整");
});

test("CloudTimeline maps HTTP 200 with missing visibility to partial", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "timeline partial state runs once on desktop");
  await page.route("**/api/forecast?**", async (route) => {
    const url = new URL(route.request().url());
    const locations = buildNormalizedForecasts(
      fixture,
      (url.searchParams.get("latitude") ?? "").split(",").filter(Boolean),
      (url.searchParams.get("longitude") ?? "").split(",").filter(Boolean),
      14,
      url.searchParams.get("model") ?? "icon",
    );
    for (const location of locations) location.hourly = location.hourly.map((hour: HourWeather) => ({ ...hour, visibility: null }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ locations, metadata: locations[0]?.metadata }) });
  });
  await page.goto(selectedUrl);
  await expect(page.getByTestId("hourly-data-validity")).toHaveAttribute("data-state", "partial", { timeout: 20_000 });
  await expect(page.getByTestId("hourly-data-validity")).toContainText("能见度");
});

test("ObservingMapControl keeps fresh all-unknown snapshots withheld", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "map eligibility runs once on desktop");
  await page.route("**/api/observing/snapshot**", async (route) => {
    const url = new URL(route.request().url());
    const focusTime = url.searchParams.get("time") ?? undefined;
    const focusScores = Object.fromEntries(
      Array.from({ length: 282 }, (_, index) => [`finder-${String(index + 1).padStart(3, "0")}-location`, {
        score: null,
        band: "unknown",
        cloud: null,
        darkness: null,
        weatherRisk: null,
        bestWindow: null,
        blockers: ["fixture unknown"],
        confidence: "unknown",
        validHours: 0,
        scoreBasis: "selected-forecast-hour",
        scoreTime: focusTime,
        aggregation: "single-hour",
      }]),
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ date: url.searchParams.get("date"), days: 1, model: url.searchParams.get("model") ?? "icon", generatedAt: new Date().toISOString(), sourceFetchedAt: new Date().toISOString(), source: "P3-B fixture", stale: false, sites: {}, focusTime, focusScores }),
    });
  });
  await page.goto(selectedUrl);
  await page.getByRole("tab", { name: "图层与偏好" }).click();
  await expect(page.getByTestId("map-recommendation-eligibility")).toHaveAttribute("data-state", "withheld", { timeout: 20_000 });
  await expect(page.locator(".observing-map-control:visible")).toHaveAttribute("data-score-status", "available");
  await expect(page.getByTestId("map-recommendation-eligibility")).toContainText("不发布推荐");
});
