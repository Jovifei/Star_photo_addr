import { expect, test, type Page } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function pressureAwareWindow(date: string) {
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
      status: "not-detected",
      lowerMsl: null,
      upperMsl: null,
      deltaTempC: null,
      strength: null,
    },
    summary: "E2E 云海详情 fixture",
  };
}

async function expectCloudSeaDetailContentToFit(page: Page) {
  const detail = page.locator(".cloudsea-site-detail");
  const layout = await detail.evaluate((element) => {
    const scroll = element.querySelector<HTMLElement>(".cs-detail-scroll-content");
    const cards = Array.from(
      element.querySelectorAll<HTMLElement>(".cs-detail-scroll-content > .cs-detail-card"),
    );
    const boundedItems = Array.from(
      element.querySelectorAll<HTMLElement>(".cs-detail-card, .cs-bento-tile, .cs-gear-item"),
    );

    return {
      scrollWidth: scroll?.scrollWidth ?? 0,
      clientWidth: scroll?.clientWidth ?? 0,
      cards: cards.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          top: rect.top,
          bottom: rect.bottom,
          clientHeight: card.clientHeight,
          scrollHeight: card.scrollHeight,
        };
      }),
      boundedItems: boundedItems.map((item) => ({
        className: item.className,
        clientWidth: item.clientWidth,
        scrollWidth: item.scrollWidth,
        clientHeight: item.clientHeight,
        scrollHeight: item.scrollHeight,
      })),
    };
  });

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  for (const item of layout.boundedItems) {
    expect(
      item.scrollWidth,
      `${item.className} has horizontally clipped content`,
    ).toBeLessThanOrEqual(item.clientWidth + 1);
    expect(
      item.scrollHeight,
      `${item.className} has vertically clipped content`,
    ).toBeLessThanOrEqual(item.clientHeight + 1);
  }
  for (let index = 1; index < layout.cards.length; index += 1) {
    expect(
      layout.cards[index].top,
      `cloudsea detail card ${index} overlaps card ${index - 1}`,
    ).toBeGreaterThanOrEqual(layout.cards[index - 1].bottom + 9);
  }
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

test.describe("responsive layout contract", () => {
  test("mobile home keeps the full navigation and a usable map viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "手机布局只在移动项目验证");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const navLocator = page.locator(".app-header .nav-tabs");
    await expect(navLocator).toBeVisible();
    await expect(navLocator.locator(".nav-tab")).toHaveCount(4);
    const nav = await navLocator.boundingBox();
    const commandBar = await page.locator(".workspace-commandbar").boundingBox();
    const map = await page.locator(".map-viewport").boundingBox();
    expect(nav?.width ?? 0).toBeGreaterThanOrEqual(350);
    expect(commandBar?.height ?? Infinity).toBeLessThanOrEqual(320);
    expect(map?.height ?? 0).toBeGreaterThanOrEqual(280);

    const layout = await page.locator(".workspace-canvas").evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);

    await page.getByRole("button", { name: "时间与地点筛选" }).click();
    await expect(page.getByRole("slider", { name: "观星评分时间滑窗" })).toBeVisible();
    await expect(page.getByRole("slider", { name: "推荐分数门槛" })).toBeVisible();
    await expect(page.getByRole("button", { name: /筛选目录参考 B1/ })).toBeVisible();
  });

  test("tablet home uses the map-first shell instead of three cramped columns", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "平板断点在桌面项目中覆盖");

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");

    await expect(page.getByTestId("workspace-shell")).toBeVisible();
    await expect(page.locator(".workspace-input")).toBeHidden();
    await expect(page.locator(".workspace-inspector")).toBeHidden();
    const map = await page.locator(".workspace-canvas").boundingBox();
    expect(map?.width ?? 0).toBeGreaterThanOrEqual(600);
  });

  test("wide short cloud and fireglow pages keep controls in one compact row", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "短高宽屏布局在桌面项目覆盖");
    await mockMapTiles(page);
    await page.route("**/api/cloudsea/snapshot**", async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-24";
      const window = pressureAwareWindow(date);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date, model: "gfs", generatedAt: `${date}T00:30:00.000Z`, source: "E2E GFS fixture", stale: false,
          surface: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
          pressure: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
          sites: { "cs-taizijian": { morning: window, evening: window } },
        }),
      });
    });
    await page.route("**/api/fireglow/snapshot**", async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-24";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date, model: "icon", generatedAt: `${date}T00:30:00.000Z`, source: "E2E ICON fixture", stale: false,
          sites: { "test-site": { morning: { score: 72, reason: "fixture" }, evening: { score: 68, reason: "fixture" } } },
        }),
      });
    });
    await page.setViewportSize({ width: 1653, height: 413 });

    for (const path of ["/cloudsea", "/fireglow"]) {
      await page.goto(path);
      const header = page.locator(".app-header");
      await expect(header.locator(".nav-tab")).toHaveCount(4);
      const phase = header.locator('.segmented[data-mode="phase"]');
      const dates = header.locator('.segmented[data-mode="range"]');
      const refresh = header.locator(".cloudsea-refresh, .fireglow-refresh");
      await expect(phase).toBeVisible();
      await expect(dates).toBeVisible();
      await expect(refresh).toHaveCount(1);
      const phaseBox = await phase.boundingBox();
      const dateBox = await dates.boundingBox();
      const refreshBox = await refresh.boundingBox();
      expect(Math.abs(phaseBox!.y - dateBox!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(phaseBox!.y - refreshBox!.y)).toBeLessThanOrEqual(5);
      expect(dateBox!.x - (phaseBox!.x + phaseBox!.width)).toBeLessThanOrEqual(24);
      expect(refreshBox!.x - (dateBox!.x + dateBox!.width)).toBeLessThanOrEqual(24);
      expect(phaseBox!.height).toBeLessThanOrEqual(56);
      const activeDate = dates.locator("button.active");
      const dateFill = await activeDate.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(dateFill).toBe("rgba(0, 0, 0, 0)");
      const activeDateStyle = await activeDate.evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, borderBottom: style.borderBottomColor, width: element.getBoundingClientRect().width };
      });
      expect(activeDateStyle.color).not.toBe("rgb(2, 14, 23)");
      expect(activeDateStyle.borderBottom).toBe(activeDateStyle.color === "rgb(234, 244, 247)" ? "rgb(52, 152, 219)" : "rgb(232, 101, 79)");
      expect(activeDateStyle.width).toBeLessThanOrEqual(160);
      const headerBox = await header.boundingBox();
      expect(headerBox!.height).toBeLessThanOrEqual(140);
      const dateText = (await dates.innerText()).replace(/\s+/g, " ");
      expect(dateText).toMatch(/今日.*\d{1,2}\.\d{1,2}.*周/);
      expect(dateText).toMatch(/明日.*\d{1,2}\.\d{1,2}.*周/);
      expect(dateText).toMatch(/后日.*\d{1,2}\.\d{1,2}.*周/);
      const compactControls = header.locator(".nav-tab, .cloudsea-controls button, .fireglow-controls button");
      for (const control of await compactControls.all()) {
        const controlBox = await control.boundingBox();
        const fontSize = await control.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
        expect(controlBox!.height, await control.innerText()).toBeGreaterThanOrEqual(48);
        expect(fontSize, await control.innerText()).toBeGreaterThanOrEqual(13);
      }
      const map = await page.locator(".leaflet-container").first().boundingBox();
      expect(map!.y).toBeLessThanOrEqual(200);
      expect(map!.height).toBeGreaterThanOrEqual(120);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

      const explanation = page.locator(".forecast-method-note");
      await expect(explanation).toBeVisible();
      await expect(explanation).not.toHaveAttribute("open", "");
      await page.screenshot({ path: `node_modules/.cache/dashboard-density-${path.slice(1)}-1653x413.png` });
      await activeDate.focus();
      await page.keyboard.press("Tab");
      const focusState = await header.locator(":focus-visible").evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== "none" || style.boxShadow !== "none";
      });
      expect(focusState).toBe(true);
      await explanation.locator("summary").click();
      await expect(explanation.locator("p")).toBeVisible();
    }
  });

  test("mobile cloudsea detail opens as a bottom dialog without shrinking its cards", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "手机详情抽屉只在移动项目验证");

    await mockMapTiles(page);
    await page.route("**/api/cloudsea/snapshot**", async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-18";
      const window = pressureAwareWindow(date);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date,
          model: "gfs",
          generatedAt: `${date}T00:30:00.000Z`,
          source: "E2E surface + pressure-level model profile",
          stale: false,
          surface: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
          pressure: { status: "available", availableSites: 54, totalSites: 54, failedSites: 0 },
          sites: { "cs-taizijian": { morning: window, evening: window } },
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/cloudsea");
    const card = page.locator(".cloudsea-card").first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const detail = page.locator(".cloudsea-site-detail");
    await expect(detail).toHaveAttribute("role", "dialog");
    await expect(detail).toHaveAttribute("aria-modal", "true");
    await page.waitForTimeout(250);
    const box = await detail.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    expect(box!.y).toBeGreaterThanOrEqual(844 * 0.2);

    const detailScroll = await detail.locator(".cs-detail-scroll-content").evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    expect(detailScroll.scrollHeight).toBeGreaterThan(detailScroll.clientHeight);

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 812 },
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 577, height: 1231 },
      { width: 768, height: 1024 },
      { width: 844, height: 390 },
      { width: 1280, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(50);
      await expectCloudSeaDetailContentToFit(page);
    }

    await detail.getByRole("button", { name: "关闭云海详情舱" }).click();
    await expect(card).toBeFocused();
  });

  test("mobile fireglow detail opens as the same bottom dialog contract", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "手机详情抽屉只在移动项目验证");

    await mockMapTiles(page);
    await page.route("**/api/fireglow/snapshot**", async (route) => {
      const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-18";
      const window = {
        score: 80,
        band: "strong",
        bandLabel: "大烧",
        probabilityLabel: "80–88%",
        probabilityLevel: "p80",
        vividness: 0.8,
        momentLabel: "中云爆发",
        peakTime: "19:00",
        deckCloud: 30,
        lowCloud: 10,
        midCloud: 40,
        highCloud: 55,
        visibilityKm: 18,
        sunAltitude: -1.5,
        goldenTime: "19:10",
        blueTime: "19:30",
        astroTime: "19:52",
        reason: "E2E 火烧云详情 fixture",
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          date,
          model: "icon",
          generatedAt: `${date}T00:30:00.000Z`,
          source: "E2E fireglow snapshot",
          stale: false,
          sites: { "finder-001-location": { morning: window, evening: window } },
        }),
      });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/fireglow");
    const card = page.locator(".fireglow-list button").first();
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();

    const detail = page.locator(".fireglow-site-detail");
    await expect(detail).toHaveAttribute("role", "dialog");
    await expect(detail).toHaveAttribute("aria-modal", "true");
    await page.waitForTimeout(250);
    const box = await detail.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await detail.getByRole("button", { name: "关闭火烧云详情舱" }).click();
    await expect(card).toBeFocused();
  });
});
