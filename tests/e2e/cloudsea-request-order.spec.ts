import { expect, test } from "@playwright/test";

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

function snapshot(date: string, score: number) {
  const window = {
    score,
    conditionLevel: "p90",
    conditionLabel: `${score}/100`,
    probabilityLevel: "p90",
    probabilityLabel: `${score}/100`,
    cloudPosition: "above",
    positionLabel: "山顶在云层上方",
    cloudBaseM: 500,
    cloudTopM: 1200,
    altitudeDiffM: 600,
    lowCloud: 20,
    midCloud: 10,
    highCloud: 5,
    humidity: 70,
    windSpeed: 1.2,
    peakTime: "06:00",
    pressureTime: `${date}T06:00`,
    pressureStatus: "available",
    pressureConfidence: "中",
    inversion: { status: "detected", lowerMsl: 500, upperMsl: 750, deltaTempC: 2, strength: "moderate" },
    summary: `请求代次测试 ${date}`,
  };
  return {
    date,
    model: "gfs",
    generatedAt: `${date}T00:30:00.000Z`,
    source: "E2E request ordering",
    stale: false,
    pressure: { status: "available", availableSites: 1, totalSites: 1, failedSites: 0 },
    sites: { "cs-taizijian": { morning: window, evening: window } },
  };
}

test("云海日期切换不会让旧请求覆盖当前日期", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "请求代次测试在桌面 Chromium 执行一次");
  const base = shanghaiDateKey();
  const tomorrow = shiftDate(base, 1);
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }),
  );
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? base;
    const delay = date === tomorrow ? 350 : 20;
    const score = date === tomorrow ? 22 : 88;
    await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(snapshot(date, score)) });
  });

  await page.goto("/cloudsea");
  const dateButtons = page.locator('[aria-label="预报日期选择"] button');
  const todayButton = dateButtons.nth(0);
  const tomorrowButton = dateButtons.nth(1);
  await expect(todayButton).toBeVisible();
  await tomorrowButton.click();
  await expect(tomorrowButton).toHaveClass(/active/);
  await todayButton.click();
  await expect(todayButton).toHaveClass(/active/);
  await expect(page.locator(".cloudsea-sidebar-header")).toContainText(
    `${Number(base.slice(5, 7))}月${Number(base.slice(8, 10))}日`,
    { timeout: 5000 },
  );
  await expect(page.locator(".cloudsea-card-score").first()).toContainText("88/100", { timeout: 5000 });
  await expect(page.locator(".cloudsea-card-summary").first()).toContainText(base);
});
