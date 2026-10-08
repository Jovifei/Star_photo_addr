import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const textSelector = "button, span, p, label, h1, h2, h3, a, td, th, summary, input";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.fallback() : route.abort());
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  await installOpenMeteoMock(page, fixture);
  await installNextApiMock(page, fixture);
  await installGeocodingMock(page);
});

async function textClipping(page: Page) {
  return page.evaluate(() => {
    const failures: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(".nav-tab > span, .candidate-metric-item, .app-header-title, .workspace-commandbar .recommendation-quick-toggle, .workspace-commandbar .recommendation-quick-slider > span")) {
      if (!element.checkVisibility()) continue;
      const box = element.getBoundingClientRect();
      if (!box.width || !box.height) continue;
      const boundary = element.matches(".nav-tab > span") ? element.closest<HTMLElement>(".nav-tab")! : element.matches(".app-header-title") ? element.closest<HTMLElement>(".app-header-brand-copy")! : element.matches(".recommendation-quick-slider > span") ? element.closest<HTMLElement>(".recommendation-quick-slider")! : element;
      const limit = boundary.getBoundingClientRect();
      const verticalLimit = element.matches(".app-header-title") ? element.closest<HTMLElement>(".product-header")!.getBoundingClientRect() : limit;
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (!node.textContent?.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          if (rect.left < limit.left - 1 || rect.right > limit.right + 1 || rect.top < verticalLimit.top - 1 || rect.bottom > verticalLimit.bottom + 1) {
            failures.push(`${element.className}: ${node.textContent?.trim()}`);
          }
        }
      }
      if (element.matches(".candidate-metric-item") && element.scrollWidth > element.clientWidth + 1) failures.push(`metric horizontal overflow: ${element.textContent}`);
    }
    return failures;
  });
}

for (const multiplier of [1, 2]) test(`${multiplier * 100}% measured text keeps navigation and candidate values readable`, async ({ page }, info) => {
  const mobile = info.project.name === "mobile";
  await page.setViewportSize(mobile ? { width: 375, height: 812 } : { width: 1440, height: 1000 });
  await page.goto("/?lat=30.4694&lng=119.5978&name=release-audit&model=icon");
  await expect(page.getByTestId("home-context-strip")).toHaveAttribute("data-updated-at", /\d{4}-/);
  if (mobile) await expandMobileDataSheet(page);
  const card = page.locator(mobile ? ".mobile-sheet-candidates .candidate-card" : ".candidate-card").first();
  await card.scrollIntoViewIfNeeded();
  // Match the independent acceptance procedure: text-only computed-size stress,
  // not browser zoom, DPR emulation or a blanket root-font-size change.
  const measured = await page.evaluate(({ selector, multiplier }) => {
    const targets = [...document.querySelectorAll<HTMLElement>(selector)];
    const sizes = targets.map((el) => parseFloat(getComputedStyle(el).fontSize));
    targets.forEach((el, i) => el.style.setProperty("font-size", `${sizes[i] * multiplier}px`, "important"));
    const ratios = targets.filter((el) => el.matches(".nav-tab > span, .candidate-metric-item > span")).map((el) => parseFloat(getComputedStyle(el).fontSize) / sizes[targets.indexOf(el)]);
    return { ratios, innerWidth, innerHeight, dpr: devicePixelRatio, scale: visualViewport?.scale };
  }, { selector: textSelector, multiplier });
  expect(measured.ratios.length).toBeGreaterThan(4);
  measured.ratios.forEach((ratio) => expect(ratio).toBeCloseTo(multiplier, 2));
  await card.scrollIntoViewIfNeeded();
  await expect.poll(() => textClipping(page)).toEqual([]);
  const nav = page.getByRole("navigation", { name: "页面导航" });
  await expect(nav.getByRole("link")).toHaveCount(4);
  const geometry = await page.evaluate(() => {
    const nav = document.querySelector<HTMLElement>(".nav-tabs")!;
    const shell = nav.closest<HTMLElement>(".app-shell")!;
    const header = document.querySelector<HTMLElement>(".product-header")!;
    const command = document.querySelector<HTMLElement>(".workspace-commandbar")!;
    const brand = header.querySelector<HTMLElement>(".app-header-brand")!.getBoundingClientRect();
    const controls = header.querySelector<HTMLElement>(".app-header-controls")!.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    return { brandOverlapsNav: brand.right - navBox.left, navOverlapsControls: navBox.right - controls.left, navHeight: nav.getBoundingClientRect().height, navBottom: nav.getBoundingClientRect().bottom, reservedBottom: parseFloat(getComputedStyle(shell).paddingBottom), headerBottom: header.getBoundingClientRect().bottom, commandTop: command.getBoundingClientRect().top, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  if (mobile) {
    expect(geometry.navBottom).toBeLessThanOrEqual(812.5);
    expect(geometry.reservedBottom).toBeGreaterThanOrEqual(geometry.navHeight - 0.5);
  } else {
    expect(geometry.headerBottom).toBeLessThanOrEqual(geometry.commandTop + 0.5);
    expect(geometry.brandOverlapsNav).toBeLessThanOrEqual(0.5);
    expect(geometry.navOverlapsControls).toBeLessThanOrEqual(0.5);
  }
  await info.attach(`text-${multiplier * 100}-metadata`, { body: Buffer.from(JSON.stringify({ measured, geometry })), contentType: "application/json" });
  await info.attach(`text-${multiplier * 100}-view`, { body: await page.screenshot({ fullPage: false }), contentType: "image/png" });
});
