import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "./mock-open-meteo.js";

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

  // Keep the browser run offline from real providers: tile imagery is a
  // synthetic one-pixel fixture and any other external request is aborted.
  await page.route("https://**/*", async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng });
      return;
    }
    await route.abort();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-10-12";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E synthetic map snapshot",
        stale: false,
        sites: { "finder-001-location": {
          morning: scoreWindow(78, "06:08"),
          evening: scoreWindow(74, "18:18"),
        } },
      }),
    });
  });
});

async function blankTouchPair(page: Page, map: ReturnType<Page["locator"]>) {
  return map.evaluate((container) => {
    const rect = container.getBoundingClientRect();
    const blocked = [
      ".topic-site-marker", ".topic-pick-marker", ".observing-site-marker",
      ".viewport-rank-marker", ".selected-sample-marker", ".leaflet-control",
      ".leaflet-popup", ".leaflet-tooltip", ".map-render-status", ".fireglow-map-status",
    ];
    const candidates: Array<{ x: number; y: number }> = [];
    for (const yf of [0.16, 0.25, 0.36, 0.48, 0.60, 0.72, 0.82]) {
      for (const xf of [0.16, 0.28, 0.40, 0.52, 0.64, 0.76, 0.84]) {
        const x = Math.round(rect.left + rect.width * xf);
        const y = Math.round(rect.top + rect.height * yf);
        const stack = document.elementsFromPoint(x, y);
        if (!stack.length || !container.contains(stack[0])) continue;
        if (stack.some((element) => blocked.some((selector) => element.closest(selector)))) continue;
        candidates.push({ x, y });
      }
    }
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const a = candidates[i]!;
        const b = candidates[j]!;
        if (Math.hypot(a.x - b.x, a.y - b.y) >= 44) return [a, b] as const;
      }
    }
    throw new Error("Could not find two unobstructed points on the visible map canvas");
  });
}

async function mapZoom(page: Page) {
  return Number(await page.locator(".leaflet-container").first().getAttribute("data-map-zoom"));
}

async function mapCenter(page: Page) {
  return page.locator(".leaflet-container").first().getAttribute("data-map-center");
}

for (const surface of [
  { route: "/", selector: ".selected-sample-marker", label: "MapCanvas" },
  { route: "/fireglow", selector: ".topic-pick-marker", label: "BlankMapPicker" },
]) {
  test(`${surface.label}: touch drag, multitouch and cancel do not pick; next tap recovers`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "real touch input is exercised in mobile Chromium");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(surface.route);
    const map = page.locator(".leaflet-container").first();
    await expect(map).toHaveAttribute("data-map-zoom", /\d+/);
    await expect(page.locator(surface.selector)).toHaveCount(0);
    const selectedLocation = page.locator(".mobile-data-sheet-location");
    if (surface.label === "BlankMapPicker") {
      await expect(selectedLocation).not.toContainText("所点坐标");
    }
    const cdp = await page.context().newCDPSession(page);

    const [dragPoint] = await blankTouchPair(page, map);
    const beforeDrag = await mapCenter(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: dragPoint.x, y: dragPoint.y }],
    });
    for (let step = 1; step <= 6; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: dragPoint.x + step * 12, y: dragPoint.y + step * 8 }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => mapCenter(page)).not.toBe(beforeDrag);
    await expect(page.locator(surface.selector)).toHaveCount(0);

    const [pinchA, pinchB] = await blankTouchPair(page, map);
    const beforePinch = await mapZoom(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { id: 11, x: pinchA.x, y: pinchA.y },
        { id: 12, x: pinchB.x, y: pinchB.y },
      ],
    });
    for (let step = 1; step <= 5; step += 1) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { id: 11, x: pinchA.x - step * 8, y: pinchA.y },
          { id: 12, x: pinchB.x + step * 8, y: pinchB.y },
        ],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(() => mapZoom(page)).toBeGreaterThan(beforePinch);
    await expect(page.locator(surface.selector)).toHaveCount(0);

    const [cancelPoint] = await blankTouchPair(page, map);
    await map.evaluate((container) => {
      const target = window as Window & { __e2ePointerCancelCount?: number };
      target.__e2ePointerCancelCount = 0;
      container.addEventListener("pointercancel", () => {
        target.__e2ePointerCancelCount = (target.__e2ePointerCancelCount ?? 0) + 1;
      });
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 21, x: cancelPoint.x, y: cancelPoint.y }],
    });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await expect.poll(() => page.evaluate(() =>
      (window as Window & { __e2ePointerCancelCount?: number }).__e2ePointerCancelCount ?? 0,
    )).toBeGreaterThan(0);
    await expect(page.locator(surface.selector)).toHaveCount(0);

    const [recoveryPoint] = await blankTouchPair(page, map);
    await page.touchscreen.tap(recoveryPoint.x, recoveryPoint.y);
    await expect(page.locator(surface.selector)).toHaveCount(1);
    if (surface.label === "BlankMapPicker") {
      await expect(selectedLocation).toContainText("所点坐标");
      const pickedSummary = await selectedLocation.textContent();
      const markerBox = await page.locator(".topic-pick-marker").boundingBox();
      expect(markerBox).not.toBeNull();
      await page.touchscreen.tap(
        markerBox!.x + markerBox!.width / 2,
        markerBox!.y + markerBox!.height / 2,
      );
      await expect(selectedLocation).toHaveText(pickedSummary!);
    }
    await cdp.detach();
  });
}

function dateKey(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function calendarLabel(date: string) {
  const [, month, day] = date.split("-").map(Number);
  const weekday = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    weekday: "short",
  }).format(new Date(`${date}T12:00:00Z`));
  return `${month}月${day}日 ${weekday}`;
}

function scoreWindow(score: number | null, peakTime: string | null) {
  return {
    score,
    band: score == null ? "unknown" : "medium",
    bandLabel: score == null ? "数据不足" : "中烧",
    probabilityLevel: score == null ? null : "p60",
    probabilityLabel: score == null ? null : `${score}/100`,
    vividness: score == null ? null : 0.72,
    momentLabel: score == null ? null : "云隙",
    peakTime,
    deckCloud: score == null ? null : 35,
    lowCloud: score == null ? null : 20,
    midCloud: score == null ? null : 35,
    highCloud: score == null ? null : 40,
    visibilityKm: score == null ? null : 18,
    sunAltitude: score == null ? null : -2,
    goldenTime: score == null ? null : "05:48",
    blueTime: score == null ? null : "05:25",
    astroTime: score == null ? null : "04:52",
    reason: score == null ? "fixture has no score" : "synthetic dawn score",
  };
}

test("FireGlow dawn UI labels the selected calendar day and each date in the three-day view", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "calendar-day labels are verified once in desktop Chromium");
  const requestedDates = new Set<string>();
  const dailyScores = [84, 65, 42];
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date");
    if (!date) throw new Error("FireGlow request did not include its calendar date");
    requestedDates.add(date);
    const base = [...requestedDates].sort()[0] ?? date;
    const offset = [0, 1, 2].find((candidate) => dateKey(base, candidate) === date) ?? 0;
    const score = dailyScores[offset]!;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:30:00.000Z`,
        source: "E2E synthetic dawn snapshot",
        stale: false,
        sites: {
          "finder-001-location": {
            morning: scoreWindow(score, "06:12"),
            evening: scoreWindow(null, null),
          },
        },
      }),
    });
  });

  await page.goto("/fireglow");
  const phase = page.locator('.segmented[data-mode="phase"]');
  await phase.locator("button").nth(1).click();
  await expect(phase.locator("button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".fireglow-score b").first()).toHaveText("84/100");
  const baseDate = [...requestedDates][0]!;
  await expect(page.locator(".fireglow-panel-head strong")).toContainText(calendarLabel(baseDate));

  await page.locator('.segmented[data-mode="range"] button').nth(3).click();
  await expect(page.locator(".fireglow-panel-head strong")).toContainText("三日最佳");
  const chips = page.locator(".fireglow-day-chips").first().locator("i");
  await expect(chips).toHaveCount(3);
  await expect.poll(() => requestedDates.size).toBe(3);
  expect([...requestedDates].sort()).toEqual([0, 1, 2].map((day) => dateKey(baseDate, day)).sort());
  await expect(chips).toHaveText([0, 1, 2].map((day) =>
    `${calendarLabel(dateKey(baseDate, day))} ${dailyScores[day]}`,
  ));

  await page.locator(".fireglow-list button").first().click();
  await expect(page.locator(".fg-peak-tag")).toContainText("06:12");
  await info.attach("FireGlow dawn calendar-day UI", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png",
  });
});
