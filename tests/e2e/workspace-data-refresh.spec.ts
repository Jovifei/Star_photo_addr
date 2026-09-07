import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
  buildNormalizedForecasts,
} from "./mock-open-meteo.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route(
    /https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: onePixelPng,
      }),
  );
  await page.route(/https:\/\/lpm\.darkmap\.cn\/.*/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: onePixelPng,
    }),
  );
});

/**
 * The workspace opens in the satellite-observation time domain (see
 * DEFAULT_CLOUD_STATE.overlayMode in src/lib/constants.ts), where the hourly
 * matrix is deliberately replaced by a "switch to forecast" note. Tests that
 * assert on real hourly cells must first move the app into the numeric
 * forecast domain and make sure the panel is expanded — that is a fixture
 * precondition, not a product bug.
 */
async function openHourlyMatrix(page: Page) {
  const forecastLayer = page.locator('[data-layer="forecast-cloud"]:visible').first();
  if ((await forecastLayer.count()) > 0) {
    await forecastLayer.click();
  }
  const toggle = page.locator('[aria-controls="hourly-forecast-panel"]:visible').first();
  if ((await toggle.count()) > 0 && (await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.locator("#hourly-forecast-panel")).toBeVisible({ timeout: 20000 });
}

/**
 * The matrix is always 20:00 → 05:00. During Shanghai 00:00–05:00 the first
 * four columns belong to the previous evening and a current-day provider
 * forecast legitimately has no values for them. The 00:00 weather cell is in
 * the current provider domain both before and after that midnight boundary,
 * so it is the stable assertion target for refresh/recovery tests.
 */
function midnightWeatherCell(page: Page) {
  return page
    .locator("#hourly-forecast-panel tbody tr")
    .first()
    .locator("td")
    .nth(4);
}

test("unavailable hourly forecast shows reason with retry and recovers real values", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "选点状态反馈先测桌面");
  let allowSelectedLocationRecovery = false;
  await page.unroute("**/api/forecast?**");
  await page.route("**/api/forecast?**", async (route) => {
    const url = new URL(route.request().url());
    const isSelectedLocation =
      url.searchParams.get("latitude") === "30.4694" &&
      url.searchParams.get("longitude") === "119.5978";
    if (isSelectedLocation && !allowSelectedLocationRecovery) {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ error: "天气上游返回 HTTP 429" }),
      });
      return;
    }
    const lats = (url.searchParams.get("latitude") || "").split(",").filter(Boolean);
    const lons = (url.searchParams.get("longitude") || "").split(",").filter(Boolean);
    const days = Math.min(16, Math.max(1, Number(url.searchParams.get("days")) || 14));
    const model = url.searchParams.get("model") || "icon";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ locations: buildNormalizedForecasts(fixture, lats, lons, days, model) }),
    });
  });

  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  const availability = page.getByTestId("forecast-availability");
  await expect(availability).toBeVisible({ timeout: 20000 });
  await expect(availability).toContainText("暂不可用");
  await expect(availability).toContainText("429");
  const retry = availability.getByRole("button", { name: /重试/ });
  await expect(retry).toBeVisible();

  allowSelectedLocationRecovery = true;
  await retry.click();
  await expect(availability).toContainText(/数据更新|最近成功/, { timeout: 20000 });
  // The target point is now allowed to recover, so switching the time domain
  // cannot replace the intended 429 → retry transition.
  await openHourlyMatrix(page);
  const recoveredCell = midnightWeatherCell(page);
  await expect(recoveredCell).not.toHaveText("—", { timeout: 20000 });
});

test("manual refresh failure keeps last good values and says so", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "手动刷新降级先测桌面");
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA");
  const availability = page.getByTestId("forecast-availability");
  await expect(availability).toContainText(/数据更新|最近成功/, { timeout: 20000 });
  await openHourlyMatrix(page);
  const stableCell = midnightWeatherCell(page);
  await expect(stableCell).not.toHaveText("—", { timeout: 20000 });
  const goodValue = await stableCell.textContent();

  await page.route("**/api/forecast?**", async (route) => {
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({ error: "天气上游返回 HTTP 429" }),
    });
  });
  await page.getByRole("tab", { name: "图层与偏好" }).click();
  await page.getByRole("button", { name: /强制刷新天气/ }).click();

  await expect(availability).toContainText(/使用最近成功数据/, { timeout: 20000 });
  await expect(availability).toContainText("429");
  await expect(stableCell).toHaveText(goodValue ?? "");
});

test("fireglow date and phase switch real data and stale snapshot forces refresh", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "火烧云刷新闭环先测桌面");
  const requests: string[] = [];

  function glowWindow(score: number | null) {
    const level =
      score == null
        ? "none"
        : score >= 95
          ? "p100"
          : score >= 88
            ? "p95"
            : score >= 80
              ? "p88"
              : score >= 60
                ? "p80"
                : score >= 40
                  ? "p60"
                  : score >= 20
                    ? "p40"
                    : "p20";
    const probabilityLabel =
      score == null
        ? null
        : score >= 95
          ? "95–100%"
          : score >= 88
            ? "88–95%"
            : score >= 80
              ? "80–88%"
              : score >= 60
                ? "60–80%"
                : score >= 40
                  ? "40–60%"
                  : score >= 20
                    ? "20–40%"
                    : "0–20%";
    const band =
      score == null
        ? "unknown"
        : score >= 80
          ? "strong"
          : score >= 60
            ? "medium"
            : score >= 40
              ? "light"
              : score >= 20
                ? "faint"
                : "none";
    const bandLabel =
      score == null
        ? "暂无数据"
        : score >= 80
          ? "大烧"
          : score >= 60
            ? "较大概率"
            : score >= 40
              ? "有一定概率"
              : score >= 20
                ? "概率较低"
                : "基本无烧";
    return {
      score,
      band,
      bandLabel,
      probabilityLabel,
      probabilityLevel: level === "none" ? null : level,
      vividness: score == null ? null : Math.round((score / 100) * 100) / 100,
      momentLabel: score == null ? null : "中云爆发",
      peakTime: score == null ? null : "19:00",
      deckCloud: 30,
      lowCloud: 10,
      midCloud: 40,
      highCloud: 55,
      visibilityKm: 18,
      sunAltitude: -1.5,
      goldenTime: "19:10",
      blueTime: "19:30",
      astroTime: "19:52",
      reason: score == null ? "上游数据缺失" : "云种加权计算",
    };
  }

  function snapshotFor(date: string, stale: boolean) {
    const scores: Record<string, [number | null, number | null]> = stale
      ? { "finder-001-location": [null, null], "finder-002-location": [null, null] }
      : date.endsWith(datePartOffsets()[0])
        ? {
            "finder-001-location": [92, 40],
            "finder-002-location": [61, 85],
          }
        : {
            "finder-001-location": [55, 45],
            "finder-002-location": [88, 62],
          };
    const sites: Record<
      string,
      { evening: unknown; morning: unknown }
    > = {};
    for (const [id, [evening, morning]] of Object.entries(scores)) {
      sites[id] = { evening: glowWindow(evening), morning: glowWindow(morning) };
    }
    return {
      date,
      model: "icon",
      generatedAt: "2026-08-30T10:00:00.000Z",
      source: "e2e-mock",
      stale,
      sites,
    };
  }

  function datePartOffsets() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const base = `${values.year}-${values.month}-${values.day}`;
    const shifted = (days: number) => {
      const value = new Date(`${base}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() + days);
      return value.toISOString().slice(5, 10);
    };
    return [shifted(0), shifted(1), shifted(2)];
  }

  let forceStale = false;
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get("date") ?? "";
    requests.push(`${date}|${url.searchParams.get("refresh") ?? ""}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshotFor(date, forceStale)),
    });
  });

  await page.goto("/fireglow");
  const list = page.locator(".fireglow-list");
  await expect(list).toBeVisible({ timeout: 20000 });
  const todayFirst = await list.locator("li").first().textContent();
  expect(todayFirst).toContain("阿里暗夜公园");

  await page.getByRole("button", { name: "明日" }).click();
  await expect(list.locator("li").first()).toContainText("那曲暗夜公园", {
    timeout: 20000,
  });
  expect(requests.some((entry) => entry.endsWith("|"))).toBe(true);

  await page.getByRole("button", { name: "今日" }).click();
  await expect(list.locator("li").first()).toContainText("阿里暗夜公园", {
    timeout: 20000,
  });
  await page.getByRole("button", { name: /朝霞/ }).click();
  await expect(list.locator("li").first()).toContainText("那曲暗夜公园", {
    timeout: 20000,
  });

  forceStale = true;
  await page.getByRole("button", { name: /强制刷新火烧云快照/ }).click();
  await expect(list.locator("li").first()).toContainText("暂无数据", {
    timeout: 20000,
  });
  await expect(requests.some((entry) => entry.endsWith("|1"))).toBe(true);
});
