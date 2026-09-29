import { expect, test, type Page } from "@playwright/test";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function fireWindow(score: number) {
  return {
    score,
    band: score >= 80 ? "strong" : score >= 60 ? "medium" : "light",
    bandLabel: score >= 80 ? "强烈推荐" : score >= 60 ? "推荐" : "候选",
    probabilityLabel: `${score}`,
    probabilityLevel: score >= 95 ? "p100" : score >= 80 ? "p80" : score >= 60 ? "p60" : "p40",
    vividness: 0.5,
    momentLabel: "中云爆发",
    peakTime: "18:00",
    deckCloud: 40,
    lowCloud: 20,
    midCloud: 40,
    highCloud: 50,
    visibilityKm: 20,
    sunAltitude: -2,
    goldenTime: "17:40",
    blueTime: "18:20",
    astroTime: "19:00",
    reason: "E2E 条件指数",
  };
}

function cloudSeaWindow(score: number) {
  return {
    score,
    conditionLevel: score >= 90 ? "p100" : score >= 80 ? "p90" : score >= 60 ? "p60" : "p40",
    conditionLabel: `${score}/100`,
    probabilityLevel: score >= 90 ? "p100" : score >= 80 ? "p90" : score >= 60 ? "p60" : "p40",
    probabilityLabel: `${score}/100`,
    cloudPosition: "above",
    positionLabel: "山顶在云层上方",
    cloudBaseM: 900,
    cloudTopM: 1200,
    altitudeDiffM: 300,
    lowCloud: 70,
    midCloud: 30,
    highCloud: 20,
    humidity: 88,
    windSpeed: 2,
    peakTime: "06:00",
    pressureTime: "2026-09-10T06:00",
    pressureStatus: "available",
    pressureConfidence: "high",
    inversion: {
      status: "not-detected",
      lowerMsl: null,
      upperMsl: null,
      deltaTempC: null,
      strength: null,
    },
    summary: "E2E 云海条件指数",
  };
}

async function mockMapTiles(page: Page) {
  await page.route(
    /https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/,
    (route) => route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
}

test("火烧云分数滑块只保留达到门槛的排行地点", async ({ page }, testInfo) => {
  await mockMapTiles(page);
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-10";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:00:00.000Z`,
        source: "E2E score threshold",
        stale: false,
        sites: {
          "finder-001-location": { evening: fireWindow(72), morning: fireWindow(40) },
          "finder-002-location": { evening: fireWindow(60), morning: fireWindow(40) },
          "finder-003-location": { evening: fireWindow(40), morning: fireWindow(40) },
        },
      }),
    });
  });

  await page.goto("/fireglow");
  const mobile = testInfo.project.name === "mobile";
  if (mobile) await expandMobileDataSheet(page);
  const control = page.locator(mobile ? '.mobile-sheet-ranking [data-testid="fireglow-score-threshold"]' : '[data-testid="fireglow-score-threshold"]');
  const slider = control.getByRole("slider", { name: /晚霞参考门槛/ });
  const list = page.locator(mobile ? ".mobile-sheet-ranking" : ".fireglow-list");
  const rows = mobile ? list.locator(":scope > button") : list.locator("li");
  await expect(slider).toBeVisible();
  await expect(rows).toHaveCount(3);

  await slider.press("Home");
  for (let index = 0; index < 12; index += 1) await slider.press("ArrowRight");
  await expect(slider).toHaveValue("60");
  await expect(rows).toHaveCount(2);
  await expect(control).toContainText("≥60分");

  await slider.press("End");
  await expect(slider).toHaveValue("100");
  await expect(list.locator("button")).toHaveCount(0);
  await expect(list).toContainText("暂无达到 ≥100 分的地点");
  await expect(list).not.toContainText("数据不可用");
  await expect(list).not.toContainText("当前晚霞时段暂无有效评分");
});

test("云海分数滑块只保留达到门槛的排行地点", async ({ page }, testInfo) => {
  await mockMapTiles(page);
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-10";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "gfs",
        generatedAt: `${date}T00:00:00.000Z`,
        source: "E2E score threshold",
        stale: false,
        surface: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
        pressure: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
        sites: {
          "cs-taizijian": { morning: cloudSeaWindow(100), evening: cloudSeaWindow(40) },
          "cs-qianniugang": { morning: cloudSeaWindow(60), evening: cloudSeaWindow(40) },
          "cs-kuocangshan": { morning: cloudSeaWindow(40), evening: cloudSeaWindow(40) },
        },
      }),
    });
  });

  await page.goto("/cloudsea");
  const mobile = testInfo.project.name === "mobile";
  if (mobile) await expandMobileDataSheet(page);
  const control = page.locator(mobile ? '.mobile-sheet-ranking [data-testid="cloudsea-score-threshold"]' : '[data-testid="cloudsea-score-threshold"]');
  const slider = control.getByRole("slider", { name: /云海推荐门槛/ });
  const list = page.locator(mobile ? ".mobile-sheet-ranking" : ".cloudsea-site-list");
  const rows = mobile ? list.locator(":scope > button") : list.locator(".cloudsea-card");
  await expect(slider).toBeVisible();
  await expect(rows).toHaveCount(3);

  await slider.press("Home");
  for (let index = 0; index < 12; index += 1) await slider.press("ArrowRight");
  await expect(slider).toHaveValue("60");
  await expect(rows).toHaveCount(2);
  await expect(control).toContainText("≥60分");

  await slider.press("End");
  await expect(slider).toHaveValue("100");
  await expect(rows).toHaveCount(1);
  await expect(list).toContainText("临安太子尖");
});
