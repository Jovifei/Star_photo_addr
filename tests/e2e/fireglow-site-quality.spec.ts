import { expect, test } from "./offline-test.js";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";

const freshId = "finder-001-location";
const oldId = "finder-002-location";

function windowScore(score: number | null) {
  return {
    score, band: score == null ? "unknown" : "medium", bandLabel: score == null ? "数据不足" : "中烧",
    probabilityLevel: score == null ? null : "p60", probabilityLabel: score == null ? null : `${score}/100`,
    vividness: score == null ? null : 0.72, momentLabel: score == null ? null : "云隙", peakTime: score == null ? null : "18:30",
    deckCloud: 35, lowCloud: 20, midCloud: 35, highCloud: 40, visibilityKm: 18, sunAltitude: -2,
    goldenTime: "18:20", blueTime: "18:50", astroTime: "19:10", reason: "来源状态回归测试",
  };
}

function snapshot(date: string, sourceFetchedAt: string, mixed: boolean, firstMorning: number | null = 70) {
  const source = () => ({ provider: "Open-Meteo", model: "icon", dataset: "surface", sourceFetchedAt, providerRunAt: null, observedAt: null });
  return {
    date, model: "icon", generatedAt: sourceFetchedAt, source: "quality fixture", stale: mixed,
    provenance: { version: 1, sourcesBySite: { [freshId]: [source()], [oldId]: [source()] } },
    sourceQuality: { version: 1, staleScope: mixed ? "site" : "none", bySite: {
      [freshId]: { status: "available", model: "icon" },
      [oldId]: { status: mixed ? "stale" : "available", model: "icon" },
    } },
    sites: {
      [freshId]: { morning: windowScore(firstMorning), evening: windowScore(90) },
      [oldId]: { morning: windowScore(60), evening: windowScore(60) },
    },
  };
}

test("mixed batch keeps global warning while fresh and stale selections differ", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  const fetched = new Date().toISOString();
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date")!;
    await route.fulfill({ json: snapshot(date, fetched, true) });
  });
  await page.goto("/fireglow");
  if (mobile) await page.getByRole("button", { name: "展开数据面板" }).click();
  const ranking = mobile ? page.locator(".mobile-sheet-ranking") : page.locator(".fireglow-list");
  await expect(ranking.getByRole("button", { name: /阿里暗夜公园/ })).toBeVisible();
  await expect(page.locator(".fireglow-map-status")).toContainText("数据已降级");
  await ranking.getByRole("button", { name: /阿里暗夜公园/ }).click();
  if (mobile) {
    await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 90/100");
    await expect(page.locator(".mobile-data-sheet-status")).toContainText("部分地点或日期");
    await expandMobileDataSheet(page);
  }
  await expect(page.locator(".fg-hero-score-number")).toHaveText("90/100");
  await expect(page.locator(".fg-detail-data-status")).toHaveCount(0);
  if (!mobile) await page.getByRole("button", { name: "关闭火烧云详情舱" }).click();
  await ranking.getByRole("button", { name: /那曲暗夜公园/ }).click();
  if (mobile) {
    await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("来源已降级 · 不作推荐");
    await expandMobileDataSheet(page);
  }
  await expect(page.locator(".fg-hero-score-number")).toHaveText("60/100");
  await expect(page.locator(".fg-detail-data-status")).toContainText("所选地点使用降级的天气来源");
});

test("selection follows the chosen date and phase, including a null phase score", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  let firstDate = "";
  const fetched = new Date().toISOString();
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date")!;
    firstDate ||= date;
    await route.fulfill({ json: snapshot(date, fetched, date === firstDate, date === firstDate ? null : 70) });
  });
  await page.goto("/fireglow");
  if (mobile) await page.getByRole("button", { name: "展开数据面板" }).click();
  const ranking = mobile ? page.locator(".mobile-sheet-ranking") : page.locator(".fireglow-list");
  await ranking.getByRole("button", { name: /阿里暗夜公园/ }).click();
  if (mobile) await expandMobileDataSheet(page);
  await expect(page.locator(".fg-detail-data-status")).toHaveCount(0);
  const collapse = async () => {
    if (mobile) {
      await page.getByRole("button", { name: "收起数据面板" }).click();
      await page.getByRole("button", { name: "收起数据面板" }).click();
    }
  };
  await collapse();
  await page.locator('.segmented[data-mode="phase"] button').nth(1).click();
  if (mobile) await expandMobileDataSheet(page);
  await expect(page.locator(".fg-detail-data-status")).toContainText("所选晨晚窗口没有有效评分");
  await collapse();
  await page.locator('.segmented[data-mode="range"] button').nth(1).click();
  if (mobile) await expandMobileDataSheet(page);
  await expect(page.locator(".fg-hero-score-number")).toHaveText("70/100");
  await expect(page.locator(".fg-detail-data-status")).toHaveCount(0);
  await expect(page.locator(".fireglow-map-status")).toHaveCount(0);
  await collapse();
  await page.locator('.segmented[data-mode="range"] button').nth(0).click();
  if (mobile) await expandMobileDataSheet(page);
  await expect(page.locator(".fg-detail-data-status")).toContainText("所选晨晚窗口没有有效评分");
});

test("an open page changes its selected quality when the 30-minute source threshold passes", async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  const at = new Date("2026-10-28T12:00:00.000Z");
  await page.clock.install({ time: at });
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date")!;
    await route.fulfill({ json: snapshot(date, at.toISOString(), false) });
  });
  await page.goto("/fireglow");
  if (mobile) await page.getByRole("button", { name: "展开数据面板" }).click();
  const ranking = mobile ? page.locator(".mobile-sheet-ranking") : page.locator(".fireglow-list");
  await ranking.getByRole("button", { name: /阿里暗夜公园/ }).click();
  if (mobile) await expandMobileDataSheet(page);
  await expect(page.locator(".fg-detail-data-status")).toHaveCount(0);
  await page.clock.fastForward(30 * 60_000 + 1_000);
  await expect(page.locator(".fg-detail-data-status")).toContainText("超过 30 分钟");
  await expect(page.locator(".fireglow-map-status")).toContainText("数据已降级");
  if (mobile) await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("旧数据 · 不作推荐");
});
