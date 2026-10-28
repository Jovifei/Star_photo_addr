import { expect, test } from "./offline-test.js";
import { readFileSync } from "node:fs";
import {
  buildNormalizedForecasts,
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";
import { closeMobileMapPanel, openMobileMapPanel } from "./mobile-map-panel.js";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
);
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
  await page.route(/https:\/\/lpm\.darkmap\.cn\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
});

test("fireglow keeps mixed site quality separate and expires an open selection", async ({ page }, info) => {
  const mobile = info.project.name === "webkit-mobile";
  const at = new Date("2026-10-28T12:00:00.000Z");
  await page.clock.install({ time: at });
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    const ids = ["finder-001-location", "finder-002-location"];
    const window = (score: number) => ({ score, band: "medium", bandLabel: "中烧", probabilityLevel: "p60",
      probabilityLabel: `${score}/100`, vividness: 0.72, momentLabel: "云隙", peakTime: "18:30",
      deckCloud: 35, lowCloud: 20, midCloud: 35, highCloud: 40, visibilityKm: 18, sunAltitude: -2,
      goldenTime: "18:20", blueTime: "18:50", astroTime: "19:10", reason: "cross-browser fixture" });
    const source = { provider: "Open-Meteo", dataset: "surface", model: "icon", sourceFetchedAt: at.toISOString(), providerRunAt: null, observedAt: null };
    await route.fulfill({ json: { date, model: "icon", generatedAt: at.toISOString(), source: "fixture", stale: true,
      provenance: { version: 1, sourcesBySite: { [ids[0]]: [source], [ids[1]]: [source] } },
      sourceQuality: { version: 1, staleScope: "site", bySite: { [ids[0]]: { status: "available", model: "icon" }, [ids[1]]: { status: "stale", model: "icon" } } },
      sites: { [ids[0]]: { morning: window(90), evening: window(90) }, [ids[1]]: { morning: window(60), evening: window(60) } },
    } });
  });
  await page.goto("/fireglow");
  if (mobile) await page.getByRole("button", { name: "展开数据面板" }).click();
  const ranking = mobile ? page.locator(".mobile-sheet-ranking") : page.locator(".fireglow-list");
  await ranking.getByRole("button", { name: /阿里暗夜公园/ }).click();
  if (mobile) {
    await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("条件指数 90/100");
    await expandMobileDataSheet(page);
  }
  await expect(page.locator(".fireglow-map-status")).toContainText("数据已降级");
  await expect(page.locator(".fg-detail-data-status")).toHaveCount(0);
  await page.clock.fastForward(30 * 60_000 + 1_000);
  await expect(page.locator(".fg-detail-data-status")).toContainText("超过 30 分钟");
  if (mobile) await expect(page.locator(".mobile-data-sheet-copy strong")).toHaveText("旧数据 · 不作推荐");
});

for (const timezoneId of ["UTC", "America/Los_Angeles", "Asia/Shanghai"]) {
  test.describe(`forecast update timezone ${timezoneId}`, () => {
    test.use({ timezoneId });

    test("all update labels use Shanghai time and preserve raw UTC evidence", async ({ page }) => {
      const fetchedAt = "2026-10-03T05:15:00.573Z";
      await page.clock.setFixedTime(new Date("2026-10-03T05:16:00Z"));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.route("**/api/forecast?**", async (route) => {
        const url = new URL(route.request().url());
        const locations = buildNormalizedForecasts(
          fixture,
          (url.searchParams.get("latitude") ?? "").split(",").filter(Boolean),
          (url.searchParams.get("longitude") ?? "").split(",").filter(Boolean),
          14,
          url.searchParams.get("model") ?? "icon",
        );
        for (const location of locations) {
          location.fetchedAt = fetchedAt;
          location.metadata.fetchedAt = fetchedAt;
          location.metadata.sourceFetchedAt = fetchedAt;
          // Keep the hourly fixture aligned to the frozen observation date,
          // independent of when CI is run or its process timezone.
          location.hourly.forEach((hour: { time: string }, index: number) => {
            hour.time = new Date(Date.parse("2026-10-03T00:00:00Z") + index * 3_600_000)
              .toISOString().slice(0, 16);
          });
        }
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ locations, metadata: locations[0]?.metadata }),
        });
      });
      await page.goto("/?lat=30.4694&lng=119.5978&name=timezone-test&model=icon&overlay=forecast-cloud");
      const strip = page.getByTestId("home-context-strip");
      await expect(strip).toHaveAttribute("data-updated-at", fetchedAt);
      await expect(strip).toContainText("数据更新 13:15");
      const sheet = await expandMobileDataSheet(page);
      const summary = sheet.getByTestId("observation-reason-card");
      await expect(summary).toContainText("更新时间13:15");
      await expect(sheet.getByTestId("forecast-availability")).toHaveText("数据更新 13:15");
      await summary.getByTestId("forecast-trust-summary").click();
      await expect(summary.getByTestId("forecast-evidence-details")).toContainText(fetchedAt);
    });
  });
}

test("product navigation and source dialog remain keyboard operable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".nav-tabs .nav-tab > span")).toHaveText([
    "今夜观测",
    "暗夜选址",
    "火烧云",
    "云海",
  ]);

  // WebKit runs with an iPhone viewport, where low-frequency map controls are
  // intentionally docked in the mobile sidebar. Desktop returns false/no-op.
  const compact = await openMobileMapPanel(page, "layers");
  if (compact) {
    await closeMobileMapPanel(page);
    await expandMobileDataSheet(page);
  }
  const trigger = page.getByRole("button", { name: "数据依据与局限" });
  await trigger.focus();
  await trigger.press("Enter");

  const dialog = page.getByRole("dialog", { name: "数据依据与局限" });
  const close = dialog.getByRole("button", { name: "关闭" });
  const darkSkyLink = dialog.getByRole("link", { name: "暗夜选址" });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(darkSkyLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dark-sky compatibility route preserves a shared observation context", async ({
  page,
}) => {
  await page.goto(
    "/sites?lat=30.1234&lng=120.5678&name=%E4%B8%9C%E7%99%BD%E5%B1%B1&" +
      "elevation=1188&model=gfs&overlay=forecast-cloud",
  );

  const current = new URL(page.url());
  expect(current.pathname).toBe("/");
  expect(current.searchParams.get("lat")).toBe("30.1234");
  expect(current.searchParams.get("lng")).toBe("120.5678");
  expect(current.searchParams.get("model")).toBe("gfs");
  expect(current.searchParams.get("view")).toBe("light-pollution");
  expect(current.searchParams.get("panel")).toBe("sites");
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.getByRole("link", { name: /暗夜选址/ })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("Firefox/WebKit map keeps direct zoom and drag enabled by default", async ({ page }, info) => {
  await page.goto("/");
  const map = page.locator(".leaflet-container").first();
  await expect(map).toHaveAttribute("data-map-zoom", /\d+/);
  const initialZoom = Number(await map.getAttribute("data-map-zoom"));
  await page.locator(".leaflet-control-zoom-in").first().click();
  await expect(map).toHaveAttribute("data-map-zoom", String(initialZoom + 1));

  const center = await map.getAttribute("data-map-center");
  const box = (await map.boundingBox())!;
  const x = box.x + box.width * .35;
  const y = box.y + box.height * .42;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 70, y + 35, { steps: 6 });
  await page.mouse.up();
  await expect.poll(() => map.getAttribute("data-map-center")).not.toBe(center);

  if (info.project.name === "webkit-mobile") {
    const sheet = page.getByTestId("mobile-data-sheet");
    await page.touchscreen.tap(box.x + box.width * .24, box.y + box.height * .22);
    await expect(sheet).toHaveAttribute("data-level", "half");
    await expect(sheet.locator(".mobile-data-sheet-location")).not.toHaveText("今夜观测");
  }
});
