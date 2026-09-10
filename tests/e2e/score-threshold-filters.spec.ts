import { expect, test, type Page } from "@playwright/test";

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

test("火烧云分数滑块只保留达到门槛的排行地点", async ({ page }) => {
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
          "finder-001-location": { evening: fireWindow(100), morning: fireWindow(40) },
          "finder-002-location": { evening: fireWindow(60), morning: fireWindow(40) },
          "finder-003-location": { evening: fireWindow(40), morning: fireWindow(40) },
        },
      }),
    });
  });

  await page.goto("/fireglow");
  const control = page.getByTestId("fireglow-score-threshold");
  const slider = control.getByRole("slider", { name: /晚霞推荐门槛/ });
  const list = page.locator(".fireglow-list");
  await expect(slider).toBeVisible();
  await expect(list.locator("li")).toHaveCount(3);

  await slider.press("Home");
  for (let index = 0; index < 12; index += 1) await slider.press("ArrowRight");
  await expect(slider).toHaveValue("60");
  await expect(list.locator("li")).toHaveCount(2);
  await expect(control).toContainText("≥60分");

  await slider.press("End");
  await expect(slider).toHaveValue("100");
  await expect(list.locator("li")).toHaveCount(1);
  await expect(list).toContainText("阿里暗夜公园");
});

test("云海分数滑块只保留达到门槛的排行地点", async ({ page }) => {
  await mockMapTiles(page);
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
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
        pressure: { status: "available", availableSites: 3, totalSites: 3, failedSites: 0 },
        sites: {
          "cs-taizijian": { morning: cloudSeaWindow(100), evening: cloudSeaWindow(40) },
          "cs-qianniugang": { morning: cloudSeaWindow(60), evening: cloudSeaWindow(40) },
          "cs-kuocangshan": { morning: cloudSeaWindow(40), evening: cloudSeaWindow(40) },
        },
      }),
    });
  });

  await page.goto("/cloudsea");
  const control = page.getByTestId("cloudsea-score-threshold");
  const slider = control.getByRole("slider", { name: /云海推荐门槛/ });
  const list = page.locator(".cloudsea-site-list");
  await expect(slider).toBeVisible();
  await expect(list.locator(".cloudsea-card")).toHaveCount(3);

  await slider.press("Home");
  for (let index = 0; index < 12; index += 1) await slider.press("ArrowRight");
  await expect(slider).toHaveValue("60");
  await expect(list.locator(".cloudsea-card")).toHaveCount(2);
  await expect(control).toContainText("≥60分");

  await slider.press("End");
  await expect(slider).toHaveValue("100");
  await expect(list.locator(".cloudsea-card")).toHaveCount(1);
  await expect(list).toContainText("临安太子尖");
});
