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

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

test("failed refresh preserves the same labelled snapshot in map, list and detail, then recovers", async ({ page }) => {
  let fail = false;
  let score = 72;
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    await route.fulfill({status: fail ? 503 : 200, contentType: "application/json", body: JSON.stringify(fail ? {error:"provider temporarily unavailable"} : {
      date, model:"icon", generatedAt:new Date().toISOString(), source:"recovery test", stale:false,
      sites:{"finder-001-location":{morning:windowScore(score),evening:windowScore(score)}},
    })});
  });
  await page.goto('/fireglow');
  await expect(page.locator('.fireglow-score b').first()).toHaveText('72/100');
  const settings = page.getByRole('button',{name:'展开日期与时段设置'});
  if(await settings.isVisible()) await settings.click();
  fail = true;
  await page.getByRole('button',{name:'强制刷新火烧云快照'}).click();
  await expect(page.locator('.fireglow-map-status')).toContainText('数据已降级');
  await expect(page.locator('.fireglow-panel-head')).toContainText('数据已降级');
  await expect(page.locator('.fireglow-score b').first()).toHaveText('72/100');
  await page.locator('.fireglow-list button').first().click();
  await expect(page.locator('.fg-detail-data-status')).toContainText('数据已降级');
  await page.getByRole('button',{name:'关闭火烧云详情舱'}).click();
  fail = false; score = 81;
  await page.getByRole('button',{name:'强制刷新火烧云快照'}).click();
  await expect(page.locator('.fireglow-score b').first()).toHaveText('81/100');
  await expect(page.locator('.fireglow-map-status')).toHaveCount(0);
  await expect(page.locator('.fireglow-panel-head')).not.toContainText('数据已降级');
  await page.locator('.fireglow-list button').first().click();
  await expect(page.locator('.fg-detail-data-status')).toHaveCount(0);
  await expect(page.locator('.fg-hero-score-number')).toHaveText('81/100');
});

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

test("three-day view labels a cold failed date as incomplete across map, ranking and detail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "三日失败日期一致性仅在桌面 Chromium 验证一次");
  const requestedDates = new Set<string>();
  let missingDate: string | null = null;
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-23";
    requestedDates.add(date);
    if (date === missingDate) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture HTTP 503" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E partial three-day coverage",
        stale: false,
        sites: { "finder-001-location": { morning: windowScore(72), evening: windowScore(72) } },
      }),
    });
  });

  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-score b").first()).toHaveText("72/100");
  const baseDate = [...requestedDates][0]!;
  missingDate = shiftDate(baseDate, 2);
  await page.locator('.segmented[data-mode="range"] button').nth(3).click();

  await expect(page.locator(".fireglow-map-status")).toContainText("数据已降级");
  await expect(page.locator(".fireglow-panel-head")).toContainText("数据已降级");
  await expect(page.locator(".fireglow-error:not(.fireglow-phase-unavailable)")).toContainText("fixture HTTP 503");
  await page.locator(".fireglow-list button").first().click();
  await expect(page.locator(".fg-detail-data-status")).toContainText("数据已降级");
});

test("reports when the selected fireglow phase has no scores even if the other phase does", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "晨昏评分覆盖差异只需桌面 Chromium 验证一次");
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-23";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E single-phase coverage",
        stale: false,
        sites: { "finder-001-location": { morning: windowScore(72), evening: windowScore(null) } },
      }),
    });
  });

  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-phase-unavailable")).toContainText("晚霞");
  await expect(page.locator(".fireglow-panel-head")).toContainText("数据不足");
  await expect(page.locator(".fireglow-empty")).toContainText("当前晚霞时段暂无有效评分");
  await expect(page.locator(".fireglow-empty")).not.toContainText("暂无达到 ≥0 分");

  await page.locator('.segmented[aria-label="晨昏窗口"] button').nth(1).click();
  await expect(page.locator(".fireglow-score b").first()).toHaveText("72/100");
  await expect(page.locator(".fireglow-phase-unavailable")).toHaveCount(0);
});

test("retains the selected-phase warning when another date in the range fails", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "晨昏评分与日期降级组合只需桌面 Chromium 验证一次");
  const requestedDates = new Set<string>();
  let missingDate: string | null = null;
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-23";
    requestedDates.add(date);
    if (date === missingDate) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture HTTP 503" }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E partial phase and date coverage",
        stale: false,
        sites: { "finder-001-location": { morning: windowScore(72), evening: windowScore(null) } },
      }),
    });
  });

  await page.goto("/fireglow");
  await expect.poll(() => requestedDates.size).toBeGreaterThan(0);
  const baseDate = [...requestedDates][0]!;
  missingDate = shiftDate(baseDate, 2);
  await page.locator('.segmented[data-mode="range"] button').nth(3).click();
  await expect(page.locator(".fireglow-map-status")).toContainText("数据已降级");
  await expect(page.locator(".fireglow-phase-unavailable")).toContainText("晚霞");
  await expect(page.locator(".fireglow-error:not(.fireglow-phase-unavailable)")).toContainText("fixture HTTP 503");
});
