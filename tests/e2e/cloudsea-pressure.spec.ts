import { expect, test } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function pressureAwareWindow(date: string) {
  return {
    score: 88,
    conditionLevel: "p90",
    conditionLabel: "88/100",
    probabilityLevel: "p90",
    probabilityLabel: "88/100",
    cloudPosition: "above",
    positionLabel: "山顶在云层上方",
    cloudBaseM: 500,
    cloudTopM: 1000,
    altitudeDiffM: 558,
    lowCloud: 82,
    midCloud: 8,
    highCloud: 5,
    humidity: 90,
    windSpeed: 1.5,
    peakTime: "06:00",
    pressureTime: `${date}T06:00`,
    pressureStatus: "available",
    pressureConfidence: "中",
    inversion: {
      status: "detected",
      lowerMsl: 500,
      upperMsl: 750,
      deltaTempC: 2,
      strength: "moderate",
    },
    summary:
      "数值模式压力剖面显示山顶高出低层云顶 558m；低云 82%，近地风较弱；并检测到约 2°C 的低层逆温证据。",
  };
}

test("cloudsea renders pressure-derived evidence and opens the evidence inspector", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "云海 pressure 详情主流程由桌面 Chromium 验证一次");

  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date =
      new URL(route.request().url()).searchParams.get("date") ?? "2026-09-07";
    const window = pressureAwareWindow(date);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E surface + pressure-level model profile",
        stale: false,
        pressure: {
          status: "available",
          availableSites: 1,
          totalSites: 1,
          failedSites: 0,
        },
        sites: {
          "cs-taizijian": {
            morning: window,
            evening: window,
          },
        },
      }),
    });
  });
  await page.route(
    /https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: onePixelPng,
      }),
  );

  await page.goto("/cloudsea");

  await expect(page.locator(".cloudsea-beta-banner").first()).toContainText(
    "压力层数值模式剖面",
  );
  await expect(page.locator(".cloudsea-beta-banner").first()).toContainText(
    "不是探空或现场仪器实测",
  );

  const taizijian = page
    .locator(".cloudsea-card")
    .filter({ hasText: "临安太子尖" });
  await expect(taizijian).toBeVisible({ timeout: 15_000 });
  await expect(taizijian).toContainText("88/100");
  await expect(taizijian).toContainText("山顶在云层上方");
  await taizijian.click();

  const inspector = page.locator(".cloudsea-site-detail");
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText("数值模式垂直云层证据");
  await expect(inspector).toContainText("逆温证据");
  await expect(inspector).toContainText("中等逆温 · +2°C");
  await expect(inspector).toContainText("压力层云顶 (MSL)");
  await expect(inspector).toContainText("1000 m");
  await expect(inspector).not.toContainText("估算云顶层位");
});
