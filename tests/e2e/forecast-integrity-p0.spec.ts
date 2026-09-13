import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  buildNormalizedForecasts,
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";
import { openMobileMapPanel } from "./mobile-map-panel.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);

function coordinates(url: string): { latitudes: string[]; longitudes: string[]; days: number; model: string } {
  const parsed = new URL(url);
  return {
    latitudes: (parsed.searchParams.get("latitude") ?? "").split(",").filter(Boolean),
    longitudes: (parsed.searchParams.get("longitude") ?? "").split(",").filter(Boolean),
    days: Math.min(16, Math.max(1, Number(parsed.searchParams.get("days")) || 14)),
    model: parsed.searchParams.get("model") ?? "icon",
  };
}

function forecastBody(url: string, mutate?: (locations: ReturnType<typeof buildNormalizedForecasts>) => void) {
  const { latitudes, longitudes, days, model } = coordinates(url);
  const locations = buildNormalizedForecasts(fixture, latitudes, longitudes, days, model);
  mutate?.(locations);
  return { locations, metadata: locations[0]?.metadata };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

test("两个候选视图共享同一请求、并发不超过 2，增删候选不产生重复 in-flight", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "候选并发链路在桌面端验证一次");
  const counts = new Map<string, number>();
  const inFlight = new Set<string>();
  let duplicateInFlight = false;
  let active = 0;
  let maximum = 0;
  await page.route("**/api/forecast?**", async (route) => {
    const { latitudes, longitudes, model } = coordinates(route.request().url());
    if (latitudes.length === 1) {
      const key = `${model}|${latitudes[0]}|${longitudes[0]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (inFlight.has(key)) duplicateInFlight = true;
      inFlight.add(key);
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, 90));
      active -= 1;
      inFlight.delete(key);
    }
    await route.fallback();
  });

  await page.goto("/");
  await expect(page.locator(".candidate-card").first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(1_000);
  expect(duplicateInFlight).toBe(false);
  expect(maximum).toBeLessThanOrEqual(2);
  expect([...counts.values()].every((count) => count === 1)).toBe(true);

  const initialCount = await page.locator(".candidate-card").count();
  await page.locator(".candidate-card-delete").first().click();
  await expect(page.locator(".candidate-card")).toHaveCount(initialCount - 1);

  const addInput = page.locator(".star-window-add-input");
  await expect(addInput).toBeVisible();
  await addInput.fill("30.500,114.300,P0 测试点");
  await page.getByRole("button", { name: "添加", exact: true }).click();
  await expect(page.locator(".candidate-card", { hasText: "P0 测试点" })).toBeVisible({ timeout: 10_000 });
  expect(duplicateInFlight).toBe(false);
});

test("候选请求遇到 429 后在冷却期不自动重试，模型切换不会串用旧缓存", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "候选限流冷却在桌面端验证一次");
  const gfsCounts = new Map<string, number>();
  await page.route("**/api/forecast?**", async (route) => {
    const { latitudes, longitudes, model } = coordinates(route.request().url());
    if (model === "gfs" && latitudes.length === 1) {
      const key = `${latitudes[0]}|${longitudes[0]}`;
      gfsCounts.set(key, (gfsCounts.get(key) ?? 0) + 1);
      await route.fulfill({ status: 429, contentType: "application/json", headers: { "Retry-After": "60" }, body: JSON.stringify({ error: "P0 injected 429" }) });
      return;
    }
    await route.fallback();
  });
  await page.goto("/");
  await expect(page.locator(".candidate-card").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("tab", { name: "图层与偏好" }).click();
  await page.getByRole("button", { name: "GFS", exact: true }).click();
  await page.waitForTimeout(1_000);
  await page.getByRole("button", { name: "ICON", exact: true }).click();
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "GFS", exact: true }).click();
  await page.waitForTimeout(1_000);
  expect([...gfsCounts.values()].every((count) => count === 1)).toBe(true);
  const scoreTexts = await page.locator(".candidate-score-number strong").allTextContents();
  expect(scoreTexts.some((value) => value.includes("94"))).toBe(false);
});

test("stale=true 的旧 94 分不能进入地图、候选或详情推荐", async ({ page }, testInfo) => {
  const old = "2026-09-01T00:00:00.000Z";
  await page.route("**/api/forecast?**", async (route) => {
    const body = forecastBody(route.request().url(), (locations) => {
      for (const location of locations) {
        location.fetchedAt = old;
        if (location.metadata) {
          location.metadata.fetchedAt = old;
          location.metadata.sourceFetchedAt = old;
          location.metadata.stale = true;
        }
      }
    });
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "X-Data-Stale": "true" }, body: JSON.stringify(body) });
  });
  await page.route("**/api/observing/snapshot**", async (route) => {
    const url = new URL(route.request().url());
    const focusTime = url.searchParams.get("time") ?? undefined;
    const score = {
      score: 94, band: "priority", cloud: 8, darkness: 100, weatherRisk: 100,
      bestWindow: null, blockers: [], confidence: "high", validHours: 1,
      scoreBasis: "selected-forecast-hour", scoreTime: focusTime ?? null, aggregation: "single-hour",
    };
    const focusScores = Object.fromEntries(Array.from({ length: 282 }, (_, index) => [`finder-${String(index + 1).padStart(3, "0")}-location`, score]));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: url.searchParams.get("date"), days: 1, model: url.searchParams.get("model") ?? "icon",
        generatedAt: new Date().toISOString(), sourceFetchedAt: new Date().toISOString(),
        integrityVersion: "weather-integrity-v2", source: "P0 stale94 injection", stale: true, sites: {},
        ...(focusTime ? { focusTime, focusScores } : {}),
      }),
    });
  });
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&model=icon&overlay=forecast-cloud");
  await expect(page.getByTestId("observation-reason-card")).toContainText("数据不足", { timeout: 20_000 });
  if (testInfo.project.name === "desktop") {
    await expect(page.locator(".candidate-card").first()).toContainText("数据不足", { timeout: 20_000 });
  }
  await expect(page.locator(".candidate-score-number strong").filter({ hasText: "94" })).toHaveCount(0);
  await expect(page.getByTestId("observation-provenance")).toContainText("过期", { timeout: 20_000 });
  if (testInfo.project.name === "mobile") await openMobileMapPanel(page, "places");
  else await page.getByRole("tab", { name: "图层与偏好" }).click();
  const panel = page.locator(".observing-map-control:visible");
  await expect(panel).toHaveAttribute("data-score-status", "degraded", { timeout: 20_000 });
  await expect(panel).toContainText("质量：过期/降级");
  await page.screenshot({ path: `tmp/p0-integrity-stale-${testInfo.project.name}.png`, fullPage: true });
});

test("总云 8 但低云 61 时，浏览器不显示正常推荐", async ({ page }, testInfo) => {
  await page.route("**/api/forecast?**", async (route) => {
    const body = forecastBody(route.request().url(), (locations) => {
      for (const location of locations) {
        location.hourly = location.hourly.map((hour: Record<string, unknown>) => ({ ...hour, cloudCover: 8, cloudLow: 61, cloudMid: 3, cloudHigh: 4 }));
      }
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&model=icon&overlay=forecast-cloud");
  await expect(page.getByTestId("observation-reason-card")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("observation-reason-card")).toContainText("不建议", { timeout: 20_000 });
  if (testInfo.project.name === "desktop") {
    await expect(page.locator(".candidate-card").first()).toBeVisible({ timeout: 20_000 });
    const scoreTexts = await page.locator(".candidate-score-number strong").allTextContents();
    expect(scoreTexts.some((value) => Number(value) >= 70)).toBe(false);
  }
  await page.screenshot({ path: `tmp/p0-integrity-layer61-${testInfo.project.name}.png`, fullPage: true });
});

test("无有效天气预报时，时间轴质量显示为数据不足", async ({ page }) => {
  await page.route("**/api/forecast?**", async (route) => {
    await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "天气上游不可用" }) });
  });
  await page.goto("/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&model=icon&overlay=forecast-cloud");
  const quality = page.locator(".cloud-timeline-data-card small");
  await expect(quality).toBeVisible({ timeout: 20_000 });
  await expect(quality).toContainText("暂无有效预报");
  await expect(quality).toContainText("数据质量：数据不足");
  await expect(quality).not.toContainText("数据质量：可用");
});
