import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { buildNormalizedForecasts, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
import { addDays, currentNightKey, initialForecastTime } from "../../src/lib/nighttime";
import type { HourWeather } from "../../src/lib/types";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const pointUrl = "/?lat=34.0522&lng=-118.2437&name=LA&model=icon";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await installNextApiMock(page, fixture);
  await installOpenMeteoMock(page, fixture);
  await page.route("**/api/forecast?**", async route => {
    const url = new URL(route.request().url());
    const forecasts = buildNormalizedForecasts(fixture,
      (url.searchParams.get("latitude") ?? "").split(",").filter(Boolean),
      (url.searchParams.get("longitude") ?? "").split(",").filter(Boolean),
      14, url.searchParams.get("model") ?? "icon");
    if (url.searchParams.get("longitude") === "-118.2437") {
      for (const forecast of forecasts) {
        forecast.timezone = "America/Los_Angeles";
        forecast.utcOffsetSeconds = -25200;
        forecast.hourly = forecast.hourly.map((hour: HourWeather) => ({ ...hour,
          time: `${addDays(hour.time.slice(0, 10), -1)}${hour.time.slice(10)}`,
          visibility: null,
        }));
      }
    }
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ locations: forecasts, metadata: forecasts[0]?.metadata }) });
  });
});

test("point auto clock uses LA timezone and keeps available facts when ICON cannot score", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "mobile point contract runs once");
  await page.setViewportSize({ width: 504, height: 1244 });
  const now = new Date();
  await page.goto(pointUrl);
  const context = page.getByTestId("home-context-strip");
  await expect(context).toHaveAttribute("data-forecast-time", initialForecastTime(now, "America/Los_Angeles"));
  await expect(context).toHaveAttribute("data-night-key", currentNightKey(now, "America/Los_Angeles"));
  const facts = page.getByRole("region", { name: "当前时次原始天气" });
  await expect(facts).toContainText("云");
  await expect(facts).toContainText("ICON");
  const pane = page.getByTestId("mobile-data-sheet");
  await expect(pane).toContainText("月面照度");
  await expect(pane).toContainText("暗夜时长（估算）");
  await expect(pane).toContainText("缺能见度");
  await expect(pane.getByTestId("mobile-data-sheet-body")).toHaveCSS("overflow", "visible");
});

test("coordinate-bound explicit URL preserves its hour and matching evening after hydration", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "mobile point contract runs once");
  const date = addDays(initialForecastTime().slice(0, 10), 1);
  const selected = `${date}T20:00`;
  await page.goto(`${pointUrl}&forecastTime=${encodeURIComponent(selected)}`);
  const context = page.getByTestId("home-context-strip");
  await expect(context).toHaveAttribute("data-forecast-time", selected);
  await expect(context).toHaveAttribute("data-night-key", date);
  await expect(page.getByRole("link", { name: "今夜观测", exact: true })).toHaveAttribute("href", new RegExp(`forecastTime=${date}T20%3A00`));
});
