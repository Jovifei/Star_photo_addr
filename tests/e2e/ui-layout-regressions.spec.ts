import { expect, test } from "@playwright/test";

test.describe("专题工作区响应式布局回归", () => {
  test("火烧云和云海在移动端不产生页面级横向溢出", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "移动端专用布局回归");

    for (const route of ["/fireglow", "/cloudsea"]) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      // The in-app browser reserves a classic scrollbar gutter. Keep that
      // geometry in the regression so a 100vw shell cannot hide a 15px spill.
      await page.addStyleTag({ content: "html { overflow-y: scroll !important; }" });

      const metrics = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        metrics.scrollWidth,
        `${route} should fit within the mobile viewport`,
      ).toBeLessThanOrEqual(metrics.clientWidth + 1);
    }
  });

  test("首页移动端导航的四个入口都在可见导航带内", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "移动端专用布局回归");

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "html { overflow-y: scroll !important; }" });
    const nav = page.locator(".app-header .nav-tabs");
    await expect(nav).toBeVisible();

    const geometry = await nav.evaluate((element) => {
      const navRect = element.getBoundingClientRect();
      const tabs = Array.from(element.querySelectorAll<HTMLElement>(".nav-tab"));
      const lastTabRect = tabs.at(-1)?.getBoundingClientRect();
      return {
        tabCount: tabs.length,
        navWidth: navRect.width,
        contentWidth: element.scrollWidth,
        lastTabRight: lastTabRect?.right ?? 0,
        navRight: navRect.right,
        viewportWidth: document.documentElement.clientWidth,
      };
    });

    expect(geometry.tabCount).toBe(4);
    expect(geometry.contentWidth).toBeLessThanOrEqual(geometry.navWidth + 1);
    expect(geometry.lastTabRight).toBeLessThanOrEqual(geometry.navRight + 1);
    expect(geometry.navRight).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  });
});
