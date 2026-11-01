import { expect, test, type Page } from "./offline-test.js";
import { CLOUD_SEA_SITES } from "../../src/lib/cloudseaSites";
import { conditionLevelFor } from "../../src/lib/cloudsea";

const taizijian = CLOUD_SEA_SITES.find(site => site.id === "cs-taizijian")!;
const selectedTaizijianHref = `/cloudsea?${new URLSearchParams({
  sourceScope: "cloudsea", sourceId: taizijian.id, canonicalId: `cloudsea:${taizijian.id}`,
  lat: String(taizijian.latitude), lng: String(taizijian.longitude), name: taizijian.name,
})}`;

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
  peakScore?: number | null;
  coverage?: { expectedHours: number; surfaceValidHours: number; scoreableHours: number; pressureHours: number };
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
    conditionLevel: score == null ? null : conditionLevelFor(score),
    conditionLabel: score == null ? null : `${score}/100`,
    probabilityLevel: score == null ? null : conditionLevelFor(score),
    probabilityLabel: score == null ? null : `${score}/100`,
    cloudPosition,
    positionLabel,
    cloudBaseM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 500,
    cloudTopM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 1000,
    cloudTopUpperM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 1250,
    altitudeDiffM: cloudPosition === "unknown" || cloudPosition === "clear" ? null : 308,
    lowCloud: cloudPosition === "unknown" ? 80 : 82,
    midCloud: 8,
    highCloud: 5,
    humidity: options.humidity ?? 90,
    windSpeed: options.windSpeed ?? 2,
    peakTime: options.peakTime ?? "06:00",
    ...(options.peakScore !== undefined ? { peakScore: options.peakScore } : {}),
    ...(options.coverage ? { coverage: options.coverage } : {}),
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
    scoreVersion: "cloudsea-native-conservative-v3",
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
  await expect(detail).toContainText("压力层时次齐备");
  await expect(detail.getByTestId("cloudsea-field-blueprint")).not.toHaveAttribute("open");
  await detail.getByTestId("cloudsea-field-blueprint").locator("summary").click();
  await expect(detail.locator(".cs-gear-grid")).toBeVisible();
});

test("legacy cached summit-cloud wording is corrected in the ranking and detail", async ({ page }, info) => {
  const date = shanghaiDateKey();
  const body = snapshot(date, { score: 22, cloudPosition: "in", peakScore: 22,
    coverage: { expectedHours: 3, surfaceValidHours: 3, scoreableHours: 3, pressureHours: 3 } });
  const oldWindow = { ...body.sites["cs-taizijian"].evening, cloudBaseM: 1550, cloudTopM: 1550,
    cloudTopUpperM: 2070, altitudeDiffM: -61, pressureConfidence: "低",
    summary: "数值模式压力剖面显示山顶海拔（1489m）落在低层云 deck（1550–1550m）内，存在云雾包裹风险。 窗口 3/3 个目标时次参与平均条件指数。" };
  await mockSnapshot(page, { ...body, sites: { "cs-damingshan": { morning: oldWindow, evening: oldWindow } } });
  await page.goto("/cloudsea");
  if (info.project.name === "desktop") {
    const card = page.locator(".cloudsea-card").filter({ hasText: "临安大明山" });
    await expect(card).toContainText("山顶接近或可能处于云层");
    await expect(card).toContainText("22/100");
    await card.click();
    await page.locator('.leaflet-overlay-pane path[stroke="#ffffff"]').click();
    await expect(page.locator(".cloudsea-popup")).toContainText("最高有云采样层: 1550m");
    await expect(page.locator(".cloudsea-popup")).toContainText("山顶接近或可能处于云层");
    await card.click();
  } else {
    const search = page.getByRole("searchbox", { name: "搜索目录摄影点位" });
    await search.fill("临安大明山");
    await page.getByRole("option", { name: "临安大明山" }).click();
    await expect(page.locator(".mobile-key-metrics")).toContainText("山顶接近或可能处于云层");
    await page.getByRole("button", { name: "展开数据面板" }).click();
  }
  const detail = page.locator(".cloudsea-site-detail");
  await expect(detail).toContainText("上下各150m余量");
  await expect(detail).toContainText("采样高度并非云体的实测边界");
  await expect(detail).not.toContainText("山顶处于云层内");
  await expect(detail).not.toContainText("落在低层云 deck");
  if (info.project.name === "mobile") {
    for (const width of [320, 375, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    }
  }
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
  await expect(page.locator(".cloudsea-site-detail")).toContainText("模式云顶范围 (MSL)");
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
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 88/100 · 窗口平均");
  await expect(page.locator(".mobile-data-sheet-status")).toContainText("压力层");
  await expect(page.locator(".mobile-data-sheet-copy strong")).not.toHaveText("数据降级 · 仅供参考");
});

test("CloudSea fresh partial snapshot reports coverage loss without claiming old data", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "新鲜部分覆盖与过期区分在移动端验收");
  const date = shanghaiDateKey();
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSnapshot(page, snapshot(date, {
    score: 88,
    pressureStatus: "partial",
    pressure: { status: "partial", availableSites: 20 },
    stale: false,
    refreshError: "压力层仅 20/54 地点可用",
  }));
  await page.goto("/cloudsea");
  await selectTaizijian(page);
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 88/100 · 窗口平均");
  await expect(page.locator(".mobile-data-sheet-copy strong")).not.toContainText("旧数据");
  await page.getByRole("button", { name: "展开数据面板" }).click();
  await expect(page.locator(".mobile-data-sheet-status")).toContainText("压力层仅 20/54 地点可用");
});

test("CloudSea stale partial snapshot remains explicitly old despite retaining evidence", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "真正过期的部分覆盖仍应标记为旧数据");
  const date = shanghaiDateKey();
  await page.setViewportSize({ width: 390, height: 844 });
  await mockSnapshot(page, snapshot(date, {
    score: 88,
    pressureStatus: "partial",
    pressure: { status: "partial", availableSites: 20 },
    stale: true,
    refreshError: "本次请求失败，保留原快照",
  }));
  await page.goto("/cloudsea");
  await selectTaizijian(page);
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("旧数据 · 仅供参考");
  await page.getByRole("button", { name: "展开数据面板" }).click();
  await expect(page.locator(".mobile-data-sheet-status")).toContainText("保留原快照");
});

test("CloudSea provenance labels absent fresh source as coverage loss, not legacy cache", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "来源时刻披露在桌面 Chromium 验收");
  const date = shanghaiDateKey();
  const current = snapshot(date, {
    score: null,
    cloudPosition: "unknown",
    pressureStatus: "unavailable",
    pressure: { status: "unavailable", availableSites: 0 },
  });
  await mockSnapshot(page, {
    ...current,
    provenance: { version: 1, sourcesBySite: { "cs-taizijian": [] } },
  });
  // Desktop uses the already-tested canonical selection URL; the mobile-only
  // catalogue searchbox is not present on this desktop surface.
  await page.goto(selectedTaizijianHref);
  await expect(page.locator(".cloudsea-site-detail")).toBeVisible();
  const source = page.getByTestId("snapshot-source-times");
  await source.locator("summary").click();
  await expect(source).toContainText("该地点未取得可核验原始来源时间的数据集");
  await expect(source).not.toContainText("旧快照未记录原始供应商时间");
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
  await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 88/100 · 窗口平均");
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

test("CloudSea distinguishes the mean and peak in the ranking, detail and map popup", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "popup and detail run once on desktop");
  const date = shanghaiDateKey();
  await mockSnapshot(page, snapshot(date, { score: 31, peakTime: "05:00", peakScore: 98,
    coverage: { expectedHours: 4, surfaceValidHours: 4, scoreableHours: 4, pressureHours: 4 } }));
  await page.goto("/cloudsea");
  const card = page.locator(".cloudsea-card").filter({ hasText: "临安太子尖" });
  await expect(card).toContainText("窗口平均");
  await expect(card).toContainText("31/100");
  await expect(card).toContainText("最佳 05:00 · 98/100");
  await card.click();
  await expect(page.locator(".cloudsea-site-detail")).toContainText("窗口平均");
  await page.locator('.leaflet-overlay-pane path[stroke="#ffffff"]').click();
  const popup = page.locator(".cloudsea-popup");
  await expect(popup).toContainText("窗口平均条件指数: 31/100");
  await expect(popup).toContainText("最佳 05:00 · 98/100");
  await page.screenshot({ path: info.outputPath("mean-peak-desktop-fixture.png") });
});

test("CloudSea keeps partial evidence available without ranking its peak as a window mean", async ({ page }, info) => {
  const date = shanghaiDateKey();
  const partial = snapshot(date, { score: null, peakTime: "05:00", peakScore: 98, pressureStatus: "partial",
    coverage: { expectedHours: 4, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 1 } });
  const other = cloudWindow(date, { score: 31 });
  await mockSnapshot(page, { ...partial, sites: { ...partial.sites, "cs-fuzhishan": { morning: other, evening: other } } });
  await page.goto(info.project.name === "desktop" ? selectedTaizijianHref : "/cloudsea");
  if (info.project.name === "desktop") {
    const card = page.locator(".cloudsea-card").filter({ hasText: "临安太子尖" });
    await expect(card).toHaveCount(0);
  } else {
    await selectTaizijian(page);
    await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("窗口覆盖不足");
    await page.getByRole("button", { name: "展开数据面板" }).click();
  }
  const detail = page.locator(".cloudsea-site-detail");
  await expect(detail).toContainText("窗口覆盖不足");
  await expect(detail).toContainText("可评分 1/4 时");
  await expect(detail.locator(".cs-hero-score-number")).toHaveText("—");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath(`partial-${info.project.name}-fixture.png`) });
});

test("CloudSea keeps a partial best hour attached to its winning day in three-day mode", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "three-day evidence ownership runs once");
  const base = shanghaiDateKey(), tomorrow = shiftDate(base, 1);
  await page.route("**/api/cloudsea/snapshot**", async route => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? base;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(date, {
      score: null, peakTime: "05:00", peakScore: date === tomorrow ? 98 : 60, pressureStatus: "partial",
      coverage: { expectedHours: 4, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 1 },
    })) });
  });
  await mockMapTiles(page);
  await page.goto(selectedTaizijianHref);
  await page.locator('[aria-label="预报日期选择"] button').nth(3).click();
  const detail = page.locator(".cloudsea-site-detail");
  await expect(detail.locator(".cs-date-chip")).toContainText(tomorrow);
  await expect(detail).toContainText("最佳 05:00 · 98/100");
  await expect(detail.locator(".cs-hero-score-number")).toHaveText("—");
});
