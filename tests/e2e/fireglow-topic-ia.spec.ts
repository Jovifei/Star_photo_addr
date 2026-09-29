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

test("Fireglow HTTP 200 空快照在专题 IA 中明确不可用", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "空快照 IA 在桌面验证一次");
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-29";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "P5-A empty fixture",
        stale: false,
        sites: { "finder-001-location": { evening: windowScore(null), morning: windowScore(null) } },
      }),
    });
  });
  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-error")).toContainText("未返回有效火烧云评分");
  await expect(page.locator(".fireglow-empty")).toContainText("暂无有效火烧云数据");
  await expect(page.getByTestId("fireglow-reference-details")).not.toHaveAttribute("open");
  await expect(page.locator(".fireglow-map .fireglow-legend")).toHaveCount(0);
  await expect(page.locator(".fireglow-panel-head")).toContainText("数据不可用");
});

test("Fireglow 低频色阶与口径进入排行详情披露", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "专题披露 IA 在桌面验证一次");
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-29";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "P5-A valid fixture",
        stale: false,
        sites: { "finder-001-location": { evening: windowScore(72), morning: windowScore(72) } },
      }),
    });
  });
  await page.goto("/fireglow");
  const references = page.getByTestId("fireglow-reference-details");
  await expect(references).toBeVisible();
  await expect(references).not.toHaveAttribute("open");
  await expect(page.locator(".fireglow-map .fireglow-legend")).toHaveCount(0);
  await references.locator("summary").click();
  await expect(references.locator(".fireglow-legend")).toBeVisible();
  await expect(references.locator(".fireglow-footnote")).toBeVisible();
  await page.locator(".fireglow-list button").first().click();
  const blueprint = page.getByTestId("fireglow-field-blueprint");
  await expect(blueprint).toBeVisible();
  await expect(blueprint).not.toHaveAttribute("open");
  await blueprint.locator("summary").click();
  await expect(blueprint.locator(".fg-gear-grid")).toBeVisible();
});

test("Fireglow 当前日期完全失败时不继承旧日期的降级提示", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "日期失败优先级在桌面验证一次");
  let initialDate: string | null = null;
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-29";
    initialDate ??= date;
    const usable = date === initialDate;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "P5-A date transition fixture",
        stale: false,
        sites: { "finder-001-location": { evening: usable ? windowScore(72) : windowScore(null), morning: usable ? windowScore(72) : windowScore(null) } },
      }),
    });
  });
  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-score b").first()).toHaveText("72/100");
  await page.locator('.segmented[data-mode="range"] button').nth(1).click();
  await expect(page.locator(".fireglow-panel-head")).toContainText("数据不可用");
  await expect(page.locator(".fireglow-panel-head")).not.toContainText("数据已降级");
  await expect(page.locator(".fireglow-map-status")).toHaveCount(0);
});

test("Fireglow HTTP 200 空快照在移动 peek 中明确不可用", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "移动空快照 peek 在移动 Chromium 验证一次");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-29";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "P5-A mobile empty fixture",
        stale: false,
        sites: { "finder-001-location": { evening: windowScore(null), morning: windowScore(null) } },
      }),
    });
  });
  await page.goto("/fireglow");
  await expect(page.locator(".mobile-data-sheet")).toBeVisible();
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("数据不可用 · 请刷新重试");
  await expect(page.locator(".mobile-data-sheet-copy strong")).not.toContainText("点地图查看点位");
  await expect(page.locator(".fireglow-map")).toBeVisible();

  for (const viewport of [{ width: 390, height: 844 }, { width: 812, height: 375 }]) {
    await page.setViewportSize(viewport);
    await expect(page.locator(".mobile-data-sheet")).toBeVisible();
    const geometry = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
});
