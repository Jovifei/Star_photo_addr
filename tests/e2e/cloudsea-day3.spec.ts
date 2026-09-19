import { expect, test, type Page } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][
    new Date(`${date}T12:00:00Z`).getUTCDay()
  ];
  return `${month}月${day}日 周${weekday}`;
}

function windowFor(date: string) {
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
    summary: "E2E 云海日期覆盖 fixture",
  };
}

async function mockMapTiles(page: Page) {
  await page.route(
    /https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/png",
        body: onePixelPng,
      }),
  );
}

test("云海日期控件显示日期，并实际请求后日与三日总览的全部日期", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "云海日期覆盖在桌面 Chromium 验证一次");

  const requestedDates: string[] = [];
  const requestedModels: string[] = [];
  const requestCounts = new Map<string, number>();
  let inFlight = 0;
  let maxInFlight = 0;
  const baseDate = todayKey();
  const dates = [baseDate, shiftDate(baseDate, 1), shiftDate(baseDate, 2)];

  await mockMapTiles(page);
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const date = requestUrl.searchParams.get("date") ?? baseDate;
    requestedDates.push(date);
    requestedModels.push(requestUrl.searchParams.get("model") ?? "");
    const requestCount = (requestCounts.get(date) ?? 0) + 1;
    requestCounts.set(date, requestCount);
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    const window = windowFor(date);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "gfs",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E surface + pressure-level model profile",
        stale: false,
        pressure:
          date === dates[2] && requestCount === 1
            ? { status: "partial", availableSites: 0, totalSites: 1, failedSites: 1 }
            : { status: "available", availableSites: 1, totalSites: 1, failedSites: 0 },
        sites: { "cs-taizijian": { morning: window, evening: window } },
      }),
    });
    inFlight -= 1;
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/cloudsea");
  await expect(page.locator(".cloudsea-sidebar-header")).toBeVisible();
  await expect(page.locator(".cloudsea-beta-banner").first()).toContainText(
    "Open-Meteo GFS",
  );

  await expect(
    page.getByRole("button", { name: new RegExp(`今日.*${dateLabel(dates[0])}`) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`明日.*${dateLabel(dates[1])}`) }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`后日.*${dateLabel(dates[2])}`) }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: new RegExp(`后日.*${dateLabel(dates[2])}`) })
    .click();
  await expect.poll(() => requestedDates).toContain(dates[2]);
  await expect.poll(() => requestCounts.get(dates[2]) ?? 0).toBeGreaterThanOrEqual(2);
  await expect(page.locator(".cloudsea-sidebar-header")).toContainText(dateLabel(dates[2]));

  maxInFlight = 0;
  await page.getByRole("button", { name: /三日总览/ }).click();
  await expect.poll(() => new Set(requestedDates)).toEqual(new Set(dates));
  expect(maxInFlight).toBe(1);
  expect(requestedModels.every((model) => model === "gfs")).toBe(true);
  await expect(page.locator(".cloudsea-sidebar-header")).toContainText("三日最优");
});
