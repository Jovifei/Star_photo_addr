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
        const toggle = page.locator(".topic-controls-toggle");
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator('.segmented[data-mode="phase"] button')).toHaveCount(2);
        await expect(page.locator('.segmented[data-mode="phase"] button').last()).toBeVisible();
        expect((await header.boundingBox())!.height).toBe(width >= 1200 ? 65 : 48);
        await page.keyboard.press("Escape");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        await expect(toggle).toBeFocused();
        await toggle.click();
        await page.mouse.click(10, 450);
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
      }
    }
  }
});
