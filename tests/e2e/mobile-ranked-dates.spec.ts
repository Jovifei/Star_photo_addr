import { expect, test } from "@playwright/test";

function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][new Date(`${date}T12:00:00Z`).getUTCDay()];
  return `${month}月${day}日 周${weekday}`;
}

function scoreFor(date: string, dates: string[]): number {
  const offset = dates.indexOf(date);
  return [32, 91, 64][offset] ?? 32;
}

function fireWindow(score: number) {
  return {
    score, band: "medium", bandLabel: "中烧", probabilityLevel: "p80",
    probabilityLabel: `${score}/100`, vividness: 0.72, momentLabel: "云隙",
    peakTime: "18:30", deckCloud: 35, lowCloud: 20, midCloud: 35,
    highCloud: 40, visibilityKm: 18, sunAltitude: -2,
    goldenTime: "18:20", blueTime: "18:50", astroTime: "19:10",
    reason: "三日排行日期测试",
  };
}

function cloudSeaWindow(date: string, score: number) {
  return {
    score,
    conditionLevel: "p90",
    conditionLabel: `${score}/100`,
    probabilityLevel: "p90",
    probabilityLabel: `${score}/100`,
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
    inversion: { status: "detected", lowerMsl: 500, upperMsl: 750, deltaTempC: 2, strength: "moderate" },
    summary: "三日排行日期测试",
  };
}

test("手机火烧云三日最佳排行逐行标明高分所属日期", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "移动端排行日期归属验证");
  const base = todayKey();
  const dates = [base, shiftDate(base, 1), shiftDate(base, 2)];
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? base;
    const window = fireWindow(scoreFor(date, dates));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      date, model: "icon", generatedAt: `${date}T00:30:00.000Z`, source: "mobile three-day ranking test", stale: false,
      sites: { "finder-001-location": { morning: window, evening: window } },
    }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/fireglow");
  await page.locator('.fireglow-controls .segmented[data-mode="range"] button').nth(3).click();
  await page.getByRole("button", { name: "展开数据面板" }).click();
  const sheet = page.getByTestId("mobile-data-sheet");
  await expect(sheet.locator(".mobile-sheet-ranking h3")).toContainText("三日最佳");
  await expect(sheet.locator(".mobile-sheet-ranking button").first()).toContainText(`${dateLabel(dates[1])} · 91/100`);
});

test("手机云海三日最优排行逐行标明最高指数日期", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "移动端排行日期归属验证");
  const base = todayKey();
  const dates = [base, shiftDate(base, 1), shiftDate(base, 2)];
  const onePixelPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? base;
    const window = cloudSeaWindow(date, scoreFor(date, dates));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      date, model: "gfs", generatedAt: `${date}T00:30:00.000Z`, source: "mobile three-day ranking test", stale: false,
      surface: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
      pressure: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
      sites: { "cs-taizijian": { morning: window, evening: window } },
    }) });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cloudsea");
  await page.locator('.cloudsea-controls .segmented[data-mode="range"] button').nth(3).click();
  await page.getByRole("button", { name: "展开数据面板" }).click();
  const sheet = page.getByTestId("mobile-data-sheet");
  await expect(sheet.locator(".mobile-sheet-ranking h3")).toContainText("三日最优");
  await expect(sheet.locator(".mobile-sheet-ranking button").first()).toContainText(`${dateLabel(dates[1])} · 91/100`);
});
