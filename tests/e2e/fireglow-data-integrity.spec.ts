import { expect, test } from "@playwright/test";

function windowScore(score: number | null) {
  return {
    score,
    band: score == null ? "unknown" : "medium",
    bandLabel: score == null ? "数据不足" : "中烧",
    probabilityLevel: score == null ? null : "p60",
    probabilityLabel: score == null ? null : `${score}/100`,
    vividness: score == null ? null : 0.72,
    momentLabel: score == null ? "数据不足" : "云隙",
    peakTime: score == null ? null : "18:30",
    deckCloud: score == null ? null : 35,
    lowCloud: score == null ? null : 20,
    midCloud: score == null ? null : 35,
    highCloud: score == null ? null : 40,
    visibilityKm: score == null ? null : 18,
    sunAltitude: score == null ? null : -2,
    goldenTime: score == null ? null : "18:20",
    blueTime: score == null ? null : "18:50",
    astroTime: score == null ? null : "19:10",
    reason: score == null ? "上游数据不足" : "E2E 有效火烧云数据",
  };
}

test("does not render an HTTP 200 empty fireglow snapshot as a successful zero-point ranking", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "火烧云空快照防线在桌面 Chromium 验证一次");

  let calls = 0;
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    calls += 1;
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-19";
    const score = calls === 1 ? null : 72;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E fireglow empty/valid transition",
        stale: false,
        sites: {
          "finder-001-location": { evening: windowScore(score), morning: windowScore(score) },
        },
      }),
    });
  });

  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-error")).toContainText("未返回有效火烧云评分");
  await expect(page.locator(".fireglow-empty")).toContainText("暂无有效火烧云数据");

  await page.getByRole("button", { name: "强制刷新火烧云快照" }).click();
  await expect(page.locator(".fireglow-list li").first()).toBeVisible();
  await expect(page.locator(".fireglow-score b").first()).toContainText("72/100");
  expect(calls).toBeGreaterThanOrEqual(2);
});

test("stale fireglow state is explicit on map, ranking and detail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "stale consistency在桌面 Chromium 验证一次");
  const scoreWindow = windowScore(72);
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-21";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E stale consistency",
        stale: true,
        refreshError: "上游限流，保留最近成功快照",
        sites: {
          "finder-001-location": { evening: scoreWindow, morning: scoreWindow },
        },
      }),
    });
  });

  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-map-status")).toContainText("数据已降级");
  await expect(page.locator(".fireglow-panel-head")).toContainText("数据已降级");
  await page.locator(".fireglow-list li button").first().click();
  await expect(page.getByRole("dialog", { name: /火烧云摄影详情/ })).toContainText("数据已降级");
});
