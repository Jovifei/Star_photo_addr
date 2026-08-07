import { test, expect } from "@playwright/test";

// Real-network browser smoke: NO route interception. Hits the live Open-Meteo
// API from the browser context. Kept separate so a flaky/blocked network does
// not masquerade as a code defect — it reports the real-data status honestly.
test("live smoke: app mounts and either loads real data or degrades gracefully", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/", { waitUntil: "domcontentloaded" });

  let realDataLoaded = false;
  try {
    await page.locator(".rank-card").first().waitFor({ timeout: 45000, state: "visible" });
    realDataLoaded = true;
  } catch {
    realDataLoaded = false;
  }

  if (realDataLoaded) {
    console.log("REAL_NETWORK_DATA: loaded");
    await expect(page.locator("h1")).toHaveText("星野决策");
  } else {
    // Graceful degradation: must NOT white-screen. Either empty state or a
    // stale/error banner should be shown instead of a blank page.
    console.log("REAL_NETWORK_DATA: blocked-or-degraded");
    const mounted = await page
      .locator("h1")
      .or(page.locator(".empty-state"))
      .or(page.locator(".status-banner"))
      .first()
      .isVisible()
      .catch(() => false);
    expect(mounted, "app white-screened on network failure").toBe(true);
  }

  expect(errors, `pageErrors: ${errors.join(" | ")}`).toEqual([]);
});
