import { expect, test } from "./offline-test.js";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
import type { FireGlowWindowScore } from "../../src/lib/fireglow";

const SITE_ID = "finder-001-location";
const SITE_NAME = "阿里暗夜公园";
// Catalog coordinates for the fixture site (directory handoff needs lat/lng).
const SITE_LAT = 32.356;
const SITE_LNG = 80.105;
const NOW = "2026-11-03T01:45:00.000Z";
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
type Mode = "rain" | "missing" | "solar" | "legacy-rain";

function result(mode: Mode, date: string): FireGlowWindowScore {
  const base: FireGlowWindowScore = {
    score: null, band: "unknown", bandLabel: "数据不足", probabilityLevel: null,
    probabilityLabel: null, vividness: null, momentLabel: null, peakTime: null,
    deckCloud: null, lowCloud: null, midCloud: null, highCloud: null, visibilityKm: null,
    sunAltitude: null, goldenTime: null, blueTime: null, astroTime: null,
    reason: "晨昏窗口关键云量或降水数据不完整，无法计算火烧云条件指数。",
  };
  if (mode === "missing") return { ...base, status: "insufficient" };
  if (mode === "solar") return { ...base, status: "no-solar-window", band: "none", bandLabel: "无晨昏窗口",
    reason: "晨昏窗口内没有满足太阳高度筛选的可用时次。" };
  if (mode === "legacy-rain") return { ...base, band: "none",
    reason: "窗口内降水明显，云层无法被落日点燃。" };
  return { ...base, status: "rain-excluded", band: "none", bandLabel: "降水条件排除",
    lowCloud: 8, midCloud: 40, highCloud: 30, deckCloud: 70, visibilityKm: 20,
    precipitationMm: 0.8, referenceTime: `${date}T18:00`, sunAltitude: -2,
    reason: "窗口内降水明显，符合太阳高度条件的有效时次降水均大于 0.3 mm，按现有规则不计算火烧云条件指数。" };
}

for (const width of [1440, 500]) {
  test.describe(`fireglow outcome semantics at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    for (const mode of ["rain", "missing", "solar", "legacy-rain"] as const) {
      test(`${mode} retains its real reason without a fabricated zero`, async ({ page }, info) => {
        const requests: string[] = [];
        await page.clock.install({ time: new Date(NOW) });
        await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
        // This fixture must not consume any live weather or tile-provider quota,
        // even when run by the ordinary CI Playwright config.
        await page.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return route.fallback();
          if (route.request().resourceType() === "image") return route.fulfill({ contentType: "image/png", body: pixel });
          return route.abort("blockedbyclient");
        });
        await page.route("**/api/**", (route) => route.fulfill({ status: 503, json: { error: "unrelated API disabled in fixture" } }));
        await page.route("**/api/fireglow/snapshot**", (route) => {
          requests.push(route.request().url());
          const date = new URL(route.request().url()).searchParams.get("date")!;
          const window = result(mode, date);
          const source = { provider: "Open-Meteo", dataset: "surface", model: "icon", sourceFetchedAt: NOW, providerRunAt: null, observedAt: null };
          const other = { ...result("missing", date), status: "scored", score: 70, probabilityLevel: "p60", probabilityLabel: "60–80", band: "medium", bandLabel: "中烧" };
          return route.fulfill({ json: {
            date, model: "icon", generatedAt: NOW, source: "fixture", stale: false,
            sites: { [SITE_ID]: { evening: window, morning: window },
              ...(mode === "missing" ? { "finder-002-location": { morning: other, evening: other } } : {}),
            },
            sourceQuality: { version: 1, staleScope: "none", bySite: {
              [SITE_ID]: { status: "available", model: "icon" },
              ...(mode === "missing" ? { "finder-002-location": { status: "available", model: "icon" } } : {}),
            } },
            provenance: { version: 1, sourcesBySite: {
              [SITE_ID]: [source], ...(mode === "missing" ? { "finder-002-location": [source] } : {}),
            } },
          } });
        });
        // Desktop hides the map search bar, and the ranked list only carries scored sites, so an
        // unscored site is opened through the same directory handoff the entries already support.
        await page.goto(width >= 1200
          ? `/fireglow?model=icon&lat=${SITE_LAT}&lng=${SITE_LNG}` +
              `&sourceScope=observing&sourceId=${SITE_ID}&name=${encodeURIComponent(SITE_NAME)}`
          : "/fireglow?model=icon");
        await expect(page.getByRole("button", { name: "强制刷新火烧云快照" })).toBeEnabled();
        if (width < 1200) {
          await page.getByRole("searchbox", { name: "搜索目录摄影点位" }).fill(SITE_NAME);
          await page.getByRole("option", { name: SITE_NAME, exact: true }).click();
        }
        const state = mode === "rain" || mode === "legacy-rain" ? "rain-excluded" : mode === "solar" ? "no-solar-window" : "insufficient";
        const label = state === "rain-excluded" ? "降水条件排除" : state === "no-solar-window" ? "无晨昏窗口" : "数据不足";
        if (width === 500) {
          await expect(page.locator(".mobile-data-sheet-copy strong")).toContainText(label);
          await expandMobileDataSheet(page);
        }
        const detail = page.locator(".fireglow-site-detail");
        await expect(detail).toBeVisible();
        await expect(detail).toHaveAttribute("data-window-state", state);
        await expect(detail.locator(".fg-band-pill")).toHaveText(label);
        await expect(detail.locator(".fg-hero-score-number")).toHaveText("—");
        await expect(detail.locator(".fg-peak-tag")).toHaveCount(0);
        const reason = detail.getByTestId("fireglow-window-reason");
        await expect(reason).toContainText(mode === "missing" ? "数据不完整" : mode === "solar" ? "太阳高度" : "降水");
        if (mode === "rain") {
          await expect(detail.locator(".fg-cloud-percent")).toHaveText(["30%", "40%", "8%"]);
          await expect(detail.getByTestId("fireglow-excluded-weather")).toContainText("0.8 mm");
          await expect(detail.getByTestId("fireglow-excluded-weather")).toContainText("非最佳拍摄时刻");
          await expect(detail.locator(".fg-detail-data-status")).not.toContainText("数据不足");
          await info.attach(`rain-outcome-${width}px`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
        } else {
          await expect(detail.locator(".fg-cloud-percent")).toHaveText(["—", "—", "—"]);
        }
        if (mode === "solar") {
          await expect(detail.locator(".fg-horizon-channel")).toContainText("所选时段无晨昏窗口");
          await expect(detail.locator(".fg-horizon-channel")).not.toContainText("关键云层数据不足");
        }
        if (mode === "legacy-rain") await expect(detail.getByTestId("fireglow-excluded-weather")).toContainText("旧快照未保存");
        expect(requests.length).toBeGreaterThan(0);
        expect(requests.every((url) => new URL(url).searchParams.get("refresh") !== "1")).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      });
    }
  });
}
