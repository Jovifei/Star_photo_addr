import { test, expect } from "@playwright/test";

test("four peer products retain the same compact header and navigation geometry", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== "desktop", "This case covers desktop and mobile viewports explicitly.");
  // Layout verification must never spend live provider quotas.
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  for (const { width, height } of [{ width: 1920, height: 900 }, { width: 1440, height: 900 }, { width: 1440, height: 500 }, { width: 1200, height: 900 }, { width: 960, height: 540 }, { width: 390, height: 900 }, { width: 320, height: 900 }]) {
    await page.setViewportSize({ width, height });
    for (const path of ["/", "/sites", "/fireglow", "/cloudsea"]) {
      await page.goto(path);
      const header = page.locator(".product-header");
      await expect(header).toBeVisible();
      const geometry = await header.evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        titleFont: getComputedStyle(element.querySelector("h1")!).fontSize,
        tabs: [...element.querySelectorAll(".nav-tab")].map((tab) => ({
          width: tab.getBoundingClientRect().width,
          height: tab.getBoundingClientRect().height,
          font: getComputedStyle(tab).fontSize,
        })),
        pageWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.height, `${width} ${path}`).toBe(width >= 1200 ? 65 : 48);
      expect(geometry.titleFont).toBe(width >= 1200 ? "17px" : "16px");
      expect(geometry.pageWidth).toBeLessThanOrEqual(width);
      for (const tab of geometry.tabs) {
        expect(tab.font).toBe("13px");
        expect(tab.height).toBe(width >= 1200 ? 44 : 48);
        expect(Math.abs(tab.width - geometry.tabs[0].width)).toBeLessThan(1);
      }
      if (path === "/fireglow" || path === "/cloudsea") {
        await expect(page.locator(".topic-controls-toggle")).toHaveCount(0);
        const controls = page.locator(path === "/fireglow" ? ".fireglow-controls" : ".cloudsea-controls");
        const phases = controls.locator('.segmented[data-mode="phase"] button');
        const dates = controls.locator('.segmented[data-mode="range"] button');
        await expect(phases).toHaveCount(2);
        await expect(dates).toHaveCount(4);
        // All six choices are visible before any click, including the 320px phone.
        for (const button of [...await phases.all(), ...await dates.all()]) {
          await expect(button).toBeVisible();
          const bounds = (await button.boundingBox())!;
          expect(bounds.x, `${width} ${path} choice left edge`).toBeGreaterThanOrEqual(0);
          expect(bounds.x + bounds.width, `${width} ${path} choice right edge`).toBeLessThanOrEqual(width + 1);
        }
        const map = page.locator(".leaflet-container").first();
        await expect(map).toBeVisible();
        const toolbarGeometry = await controls.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return { top: box.top, bottom: box.bottom, position: getComputedStyle(element).position,
            scrollWidth: element.scrollWidth, clientWidth: element.clientWidth };
        });
        expect(["static", "relative"]).toContain(toolbarGeometry.position);
        expect(toolbarGeometry.scrollWidth).toBeLessThanOrEqual(toolbarGeometry.clientWidth + 1);
        const headerBounds = (await header.boundingBox())!;
        expect(toolbarGeometry.top).toBeGreaterThanOrEqual(headerBounds.y + headerBounds.height - 1);
        expect(toolbarGeometry.bottom).toBeLessThanOrEqual((await map.boundingBox())!.y + 1);
        expect(headerBounds.height).toBe(width >= 1200 ? 65 : 48);
      }
    }
  }
});


test("persistent topic phase and date controls retain working mouse and keyboard handlers", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "This case covers desktop and mobile viewports explicitly.");
  // Error fixtures isolate control behavior from provider availability and quotas.
  await page.route("**/api/**", (route) => route.fulfill({ status: 503, contentType: "application/json", body: "{}" }));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/fireglow", "/cloudsea"]) {
      await page.goto(path);
      const controls = page.locator(path === "/fireglow" ? ".fireglow-controls" : ".cloudsea-controls");
      const phases = controls.locator('.segmented[data-mode="phase"] button');
      const dates = controls.locator('.segmented[data-mode="range"] button');
      await expect(phases).toHaveCount(2);
      await expect(dates).toHaveCount(4);
      const initiallyActivePhase = await phases.evaluateAll((buttons) => buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true"));
      expect(initiallyActivePhase).toBeGreaterThanOrEqual(0);
      const nextPhase = phases.nth(initiallyActivePhase === 0 ? 1 : 0);
      await nextPhase.click();
      await expect(nextPhase).toHaveAttribute("aria-pressed", "true");
      await expect(phases.nth(initiallyActivePhase)).toHaveAttribute("aria-pressed", "false");
      await dates.nth(1).click();
      await expect(dates.nth(1)).toHaveAttribute("aria-pressed", "true");
      await expect(dates.nth(0)).toHaveAttribute("aria-pressed", "false");
      await dates.nth(2).focus();
      await page.keyboard.press("Enter");
      await expect(dates.nth(2)).toHaveAttribute("aria-pressed", "true");
      await expect(dates.nth(1)).toHaveAttribute("aria-pressed", "false");
      await phases.nth(initiallyActivePhase).focus();
      await page.keyboard.press("Space");
      await expect(phases.nth(initiallyActivePhase)).toHaveAttribute("aria-pressed", "true");
      await expect(nextPhase).toHaveAttribute("aria-pressed", "false");
      await dates.nth(3).click();
      await expect(dates.nth(3)).toHaveAttribute("aria-pressed", "true");
      for (const button of [...await phases.all(), ...await dates.all()]) await expect(button).toBeVisible();
      await expect(page.locator(".topic-controls-toggle")).toHaveCount(0);
    }
  }
});
