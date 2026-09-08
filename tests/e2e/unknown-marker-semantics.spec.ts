import { expect, test, type Page } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

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

test("CloudSea null scores use an unknown marker instead of p20", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "unknown marker semantics are covered once on desktop");
  await page.route("**/api/cloudsea/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-08";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:00:00.000Z`,
        source: "E2E unknown CloudSea snapshot",
        stale: false,
        pressure: { status: "available", availableSites: 0, totalSites: 0, failedSites: 0 },
        sites: {},
      }),
    });
  });
  await mockMapTiles(page);

  await page.goto("/cloudsea");
  await expect(page.locator(".cloudsea-card").first()).toBeVisible();
  await expect(page.locator('.cloudsea-score-badge[data-level="unknown"]').first()).toContainText("—");
  await expect(page.locator(".cloudsea-score-state").first()).toContainText("数据不足");
  await expect(page.locator(".cloudsea-legend-unknown")).toContainText("数据不足");
  await expect
    .poll(() => page.locator(".leaflet-overlay-pane path").evaluateAll((paths) =>
      paths.filter((path) => Number.parseFloat(getComputedStyle(path).fillOpacity) < 0.5).length,
    ))
    .toBeGreaterThan(0);
});

test("Fireglow null scores use an unknown marker instead of p20", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "unknown marker semantics are covered once on desktop");
  await page.route("**/api/fireglow/snapshot**", async (route) => {
    const date = new URL(route.request().url()).searchParams.get("date") ?? "2026-09-08";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date,
        model: "icon",
        generatedAt: `${date}T00:00:00.000Z`,
        source: "E2E unknown Fireglow snapshot",
        stale: false,
        sites: {},
      }),
    });
  });
  await mockMapTiles(page);

  await page.goto("/fireglow");
  await expect(page.locator(".fireglow-list").first()).toBeVisible();
  await expect(page.locator('.fireglow-score[data-level="unknown"]').first()).toContainText("—");
  await expect(page.locator(".fireglow-legend-unknown")).toBeAttached();
  await expect
    .poll(() => page.locator(".leaflet-overlay-pane path").evaluateAll((paths) =>
      paths.filter((path) => Number.parseFloat(getComputedStyle(path).fillOpacity) < 0.5).length,
    ))
    .toBeGreaterThan(0);
  await page.locator(".fireglow-list button").first().click();
  await expect(page.locator('.fg-hero-score-number[data-level="unknown"]')).toContainText("—");
  await expect(page.locator(".fg-band-pill[data-level=\"unknown\"]")).toContainText("数据不足");
});
