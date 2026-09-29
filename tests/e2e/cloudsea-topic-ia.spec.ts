import { expect, test, type Page } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function shanghaiDateKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

type WindowOptions = {
  score?: number | null;
  cloudPosition?: "above" | "in" | "below" | "clear" | "unknown";
  pressureStatus?: "available" | "partial" | "unavailable";
  humidity?: number | null;
  windSpeed?: number | null;
  peakTime?: string | null;
};

function cloudWindow(date: string, options: WindowOptions = {}) {
  const score = options.score === undefined ? 88 : options.score;
  const cloudPosition = options.cloudPosition ?? "above";
  const pressureStatus = options.pressureStatus ?? "available";
  const positionLabel = {
    above: "山顶在云层上方",
    in: "山顶处于云层内",
    below: "山顶在云层下方",
    clear: "低云条件不足",
    unknown: "数据不足",
  }[cloudPosition];
  return {
    score,
    conditionLevel: score == null ? null : "p90",
    conditionLabel: score == null ? null : `${score}/100`,
    probabilityLevel: score == null ? null : "p90",
    probabilityLabel: score == null ? null : `${score}/100`,
    cloudPosition,
    positionLabel,
    cloudBaseM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 500,
    cloudTopM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 1000,
    altitudeDiffM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 558,
    lowCloud: cloudPosition === "unknown" ? 80 : 82,
    midCloud: 8,
    highCloud: 5,
    humidity: options.humidity ?? 90,
    windSpeed: options.windSpeed ?? 2,
    peakTime: options.peakTime ?? "06:00",
    pressureTime: pressureStatus === "unavailable" ? null : `${date}T06:00`,
    pressureStatus,
    pressureConfidence: pressureStatus === "available" ? "中" : null,
    inversion: {
      status: "not-detected",
      lowerMsl: null,
      upperMsl: null,
      deltaTempC: null,
      strength: null,
    },
    summary: cloudPosition === "unknown"
      ? "surface 低云条件存在，但压力层不足；不推断垂直层位。"
      : `E2E CloudSea evidence fixture ${date}`,
  };
}

function snapshot(
  date: string,
  options: WindowOptions & {
    pressure?: { status: "available" | "partial" | "unavailable"; availableSites: number };
    surface?: { status: "available" | "partial"; availableSites: number };
    stale?: boolean;
    refreshError?: string;
  } = {},
) {
  const pressure = options.pressure ?? { status: "available" as const, availableSites: 54 };
  const surface = options.surface ?? { status: "available" as const, availableSites: 54 };
  const window = cloudWindow(date, options);
  return {
    date,
    model: "gfs",
    generatedAt: `${date}T00:30:00.000Z`,
    source: "P5-B CloudSea topic IA fixture",
    stale: options.stale ?? false,
    ...(options.refreshError ? { refreshError: options.refreshError } : {}),
    surface: {
      status: surface.status,
      availableSites: surface.availableSites,
      totalSites: 54,
      failedSites: 54 - surface.availableSites,
    },
    pressure: {
      status: pressure.status,
      availableSites: pressure.availableSites,
      totalSites: 54,
      failedSites: 54 - pressure.availableSites,
    },
    sites: {
      "cs-taizijian": {
        morning: window,
        evening: window,
      },
    },
  };
}

async function mockMapTiles(page: Page) {
  await page.route(
    /https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/,
    (route) => route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
}

async function mockSnapshot(page: Page, body: unknown, status = 200) {
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await mockMapTiles(page);
}

async function selectTaizijian(page: Page) {
  await expect(page.locator(".cloudsea-card, .cloudsea-empty-no-score").first()).toBeAttached({ timeout: 15_000 });
  const search = page.getByRole("searchbox", { name: "搜索目录摄影点位" });
  await search.fill("临安太子尖");
  await page.getByRole("option", { name: "临安太子尖" }).click();
}

test("CloudSea desktop reduces map/card chrome and discloses detail evidence progressively", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "桌面 IA 在 desktop Chromium 验证一次");
  const date = shanghaiDateKey();
  await mockSnapshot(page, snapshot(date));
  await page.goto("/cloudsea");

  await expect(page.locator(".cloudsea-map-pane .cloudsea-legend")).toHaveCount(0);
  const references = page.getByTestId("cloudsea-reference-details");
  await expect(references).toBeVisible();
  await expect(references).not.toHaveAttribute("open");
  await references.locator("summary").click();
  await expect(references.locator(".cloudsea-legend-unknown")).toBeVisible();

  const card = page.locator(".cloudsea-card").filter({ hasText: "临安太子尖" });
  await expect(card).toContainText("88/100");
  await expect(card.locator(".cloudsea-profile-strip")).toHaveCount(0);
  await expect(card.locator(".cloudsea-card-summary")).toHaveCount(0);
  await card.click();
  const detail = page.locator(".cloudsea-site-detail");
  await expect(detail).toContainText("压力层证据完整");
  await expect(detail.getByTestId("cloudsea-field-blueprint")).not.toHaveAttribute("open");
  await detail.getByTestId("cloudsea-field-blueprint").locator("summary").click();
  await expect(detail.locator(".cs-gear-grid")).toBeVisible();
});

test("CloudSea pressure unavailable preserves surface facts and vertical unknown on mobile", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "移动 pressure-unavailable contract 在 mobile Chromium 验证一次");
  const date = shanghaiDateKey();
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSnapshot(page, snapshot(date, {
    score: null,
    cloudPosition: "unknown",
    pressureStatus: "unavailable",
    pressure: { status: "unavailable", availableSites: 0 },
  }));
  await page.goto("/cloudsea");
  await selectTaizijian(page);
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("垂直证据不足");
  await expect(page.locator(".mobile-key-metrics")).toContainText("90%");
  await page.getByRole("button", { name: "展开数据面板" }).click();
  await expect(page.locator(".cloudsea-site-detail")).toContainText("压力层证据不足");
  await expect(page.locator(".cloudsea-site-detail")).toContainText("不使用启发式云底补算");
  await expect(page.locator(".cloudsea-site-detail")).toContainText("压力层云顶 (MSL)");
  await expect(page.locator(".cloudsea-site-detail")).toContainText("—");
  await expect(page.locator(".mobile-data-sheet-copy strong")).not.toContainText("数据降级");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.setViewportSize({ width: 812, height: 375 });
  await expect(page.locator(".cloudsea-map-pane")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test("CloudSea pressure partial keeps a selected numeric score above global coverage notice", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "移动 partial pressure contract 在 mobile Chromium 验证一次");
  const date = shanghaiDateKey();
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSnapshot(page, snapshot(date, {
    score: 88,
    pressureStatus: "partial",
    pressure: { status: "partial", availableSites: 20 },
  }));
  await page.goto("/cloudsea");
  await selectTaizijian(page);
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 88/100");
  await expect(page.locator(".mobile-data-sheet-status")).toContainText("压力层");
  await expect(page.locator(".mobile-data-sheet-copy strong")).not.toHaveText("数据降级 · 仅供参考");
});

test("CloudSea selected detail keeps the winning date window in three-day mode", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "三日 winning-window contract 在 desktop Chromium 验证一次");
  const base = shanghaiDateKey();
  const tomorrow = shiftDate(base, 1);
  const afterTomorrow = shiftDate(base, 2);
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? base;
    const options = date === tomorrow
      ? { score: 88, humidity: 93, peakTime: "06:40" }
      : date === afterTomorrow
        ? { score: 60, humidity: 72, peakTime: "06:00" }
        : { score: 40, humidity: 61, peakTime: "05:30" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshot(date, options)),
    });
  });
  await mockMapTiles(page);
  await page.goto("/cloudsea");
  await page.locator('[aria-label="预报日期选择"] button').nth(3).click();
  const card = page.locator(".cloudsea-card").filter({ hasText: "临安太子尖" });
  await expect(card).toContainText("88/100");
  await card.click();
  await expect(page.locator(".cloudsea-site-detail .cs-detail-summary")).toContainText(tomorrow);
  await expect(page.locator(".cloudsea-site-detail .cs-date-chip")).toContainText(tomorrow);
});

test("CloudSea selected fresh winner is not downgraded by another stale date", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "三日 stale scope 在 desktop Chromium 切换到 mobile viewport 验证一次");
  const base = shanghaiDateKey();
  const tomorrow = shiftDate(base, 1);
  const afterTomorrow = shiftDate(base, 2);
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? base;
    const body = date === base
      ? snapshot(date, { score: 40, humidity: 61, peakTime: "05:30", stale: true, refreshError: "day1 stale fixture" })
      : date === tomorrow
        ? snapshot(date, { score: 60, humidity: 72, peakTime: "06:00" })
        : snapshot(date, { score: 88, humidity: 93, peakTime: "06:40" });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await mockMapTiles(page);
  await page.goto("/cloudsea");
  await page.locator('[aria-label="预报日期选择"] button').nth(3).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "展开数据面板" }).click();
  await page.locator(".mobile-sheet-ranking button").first().click();
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 88/100");
  await expect(page.locator(".mobile-key-metrics")).toContainText("93%");
  await expect(page.locator(".mobile-data-sheet-status")).toContainText("day1 stale fixture");
});

test("CloudSea total surface failure is unavailable rather than pressure partial", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "移动 total failure contract 在 mobile Chromium 验证一次");
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSnapshot(page, { error: "surface provider unavailable" }, 502);
  await page.goto("/cloudsea");
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("数据不可用 · 请重试");
  await expect(page.locator(".mobile-data-sheet-copy strong")).not.toContainText("压力");
  await expect(page.locator(".cloudsea-map-pane")).toBeVisible();
});
