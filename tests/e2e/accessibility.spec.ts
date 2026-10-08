import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const selectedPoint = "lat=30.4694&lng=119.5978&name=accessibility-fixture&model=icon";
const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test.beforeEach(async ({ page }) => {
  // External navigation/resources not covered by a fixture are blocked immediately;
  // they must not make a fixture-only accessibility check wait on the network.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "127.0.0.1"
      ? route.fallback()
      : route.abort("blockedbyclient");
  });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  // This helper also fails closed for unmocked same-origin API endpoints.
  await installNextApiMock(page, fixture);
  await page.route(/https:\/\/(?:[^/]+\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org|gibs\.test|lpm\.darkmap\.cn)\/.*/, (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: onePixelPng }),
  );
});

async function scanDocument(page: Page, testInfo: TestInfo, state: string) {
  // Scan the complete rendered document with axe's default rules. Do not hide
  // findings behind element exclusions or disabled rules. Lesser violations and
  // incomplete/manual checks remain in the attachment even when this gate passes.
  const results = await new AxeBuilder({ page }).analyze();
  await testInfo.attach(`axe-${state}`, {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: "application/json",
  });
  const blockers = results.violations.filter((violation) =>
    violation.impact === "serious" || violation.impact === "critical" ||
    violation.id === "empty-table-header" || violation.id === "landmark-unique",
  );
  expect(blockers.map(({ id, impact, help, helpUrl, nodes }) => ({
    id, impact, help, helpUrl,
    nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  })), `Serious/critical or targeted table/landmark accessibility violations in ${state}; see complete axe attachment`).toEqual([]);
}

async function openSelectedForecast(page: Page) {
  await page.goto(`/?${selectedPoint}&overlay=forecast-cloud`);
  await expect(page.getByTestId("home-context-strip")).toHaveAttribute("data-updated-at", /\d{4}-/);
  if (await page.getByTestId("mobile-data-sheet").isVisible()) {
    await expandMobileDataSheet(page);
  }
  await expect(page.getByTestId("observation-reason-card")).toBeVisible();
  await expect(page.getByTestId("forecast-availability")).toHaveAttribute("data-tone", "ready");
}

test("selected forecast and disclosed source evidence have no serious accessibility violations", async ({ page }, testInfo) => {
  await openSelectedForecast(page);
  const evidence = page.getByTestId("forecast-evidence-details");
  await evidence.locator("summary").click();
  await expect(evidence).toHaveAttribute("open", "");
  await expect(evidence).toContainText("原始抓取");
  await scanDocument(page, testInfo, "selected-forecast-evidence");
});

test("source dialog has no serious accessibility violations and retains keyboard focus", async ({ page }, testInfo) => {
  await openSelectedForecast(page);
  const trigger = page.getByRole("button", { name: "数据依据与局限" });
  await trigger.focus();
  await trigger.press("Enter");
  const dialog = page.getByRole("dialog", { name: "数据依据与局限" });
  const close = dialog.getByRole("button", { name: "关闭" });
  await expect(dialog).toBeVisible();
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("link", { name: "暗夜选址" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await scanDocument(page, testInfo, "source-dialog");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("dark-sky compatibility view has no serious accessibility violations", async ({ page }, testInfo) => {
  await page.goto(`/sites?${selectedPoint}`);
  await expect(page).toHaveURL(/view=light-pollution/);
  await expect(page.getByRole("link", { name: /暗夜选址/ })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".leaflet-container").first()).toHaveAttribute("data-map-zoom", /\d+/);
  await expect(page.getByTestId("home-context-strip")).toHaveAttribute("data-model", "ICON");
  await expect(page.getByTestId("home-context-strip")).toHaveAttribute("data-updated-at", /\d{4}-/);
  expect(new URL(page.url()).searchParams.get("name")).toBe("accessibility-fixture");
  await scanDocument(page, testInfo, "dark-sky-compatibility");
});

test("candidate keyboard actions keep selection, date changes and removal independent", async ({ page }, testInfo) => {
  await openSelectedForecast(page);
  const cards = page.locator(testInfo.project.name === "mobile"
    ? ".mobile-sheet-candidates .candidate-card" : ".candidate-card");
  const first = cards.first();
  await expect(first).toBeVisible();
  const pick = first.getByRole("button", { name: /^选择候选地点 / });
  const name = (await pick.getAttribute("aria-label"))!.replace("选择候选地点 ", "");
  await pick.focus();
  await page.keyboard.press("Enter");
  const selectedLabel = page.locator(testInfo.project.name === "mobile"
    ? ".mobile-data-sheet-location" : ".panel-location-name");
  await expect(selectedLabel).toContainText(name);
  if (testInfo.project.name === "mobile") await expandMobileDataSheet(page);
  // Act on a different candidate, so accidental parent selection is observable.
  const other = cards.filter({ hasNot: page.getByRole("button", { name: `选择候选地点 ${name}`, exact: true }) }).first();
  const otherName = (await other.locator(".candidate-name").textContent())!;
  const card = cards.filter({ has: page.getByRole("button", { name: `选择候选地点 ${otherName}`, exact: true }) });
  const date = card.locator(".mini-capsule").nth(1);
  await date.focus();
  await page.keyboard.press("Space");
  await expect(date).toHaveClass(/mini-capsule--active/);
  await expect(selectedLabel).toContainText(name);
  const count = await cards.count();
  await card.getByRole("button", { name: `从候选对比中移除 ${otherName}`, exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(cards).toHaveCount(count - 1);
  await expect(selectedLabel).toContainText(name);
});

test("fallback map tooltips retain a name through movement and fade-out", async ({ page }) => {
  await page.addInitScript(() => {
    const audit = { unnamed: [] as string[], seen: 0, retiredNamed: 0 };
    const populated = new WeakSet<Element>();
    (window as unknown as { tooltipNameAudit: typeof audit }).tooltipNameAudit = audit;
    new MutationObserver(() => {
      for (const element of document.querySelectorAll<HTMLElement>(".chinese-fallback-label[role=tooltip]")) {
        audit.seen += 1;
        if (element.textContent?.trim()) populated.add(element);
        else if (populated.has(element) && element.style.opacity === "0" && element.getAttribute("aria-label")?.trim()) audit.retiredNamed += 1;
        if (!(element.getAttribute("aria-label")?.trim() || element.textContent?.trim())) audit.unnamed.push(element.outerHTML);
      }
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "style"] });
  });
  await page.goto(`/sites?${selectedPoint}`);
  const map = page.locator(".leaflet-container").first();
  await expect(map).toHaveAttribute("data-map-zoom", /\d+/);
  await expect(page.getByTestId("home-context-strip")).toHaveAttribute("data-updated-at", /\d{4}-/);
  // Weather can be ready while the deep-link recenter is still animating.
  // Establish its observable destination before testing two user zooms;
  // Leaflet ignores another zoom request during an active zoom animation.
  await expect.poll(() => map.evaluate(element => ({
    center: element.getAttribute("data-map-center"),
    zoom: element.getAttribute("data-map-zoom"),
    panePresent: Boolean(element.querySelector(".leaflet-map-pane")),
    animating: Boolean(element.querySelector(".leaflet-zoom-anim, .leaflet-pan-anim")),
  }))).toEqual({ center: "30.46940,119.59780", zoom: "8", panePresent: true, animating: false });
  for (let step = 0; step < 2; step++) {
    const zoom = Number(await map.getAttribute("data-map-zoom"));
    await page.locator(".leaflet-control-zoom-in").first().click();
    await expect(map).toHaveAttribute("data-map-zoom", String(zoom + 1));
  }
  await expect.poll(() => page.evaluate(() => (window as unknown as { tooltipNameAudit: { retiredNamed: number } }).tooltipNameAudit.retiredNamed)).toBeGreaterThan(0);
  const audit = await page.evaluate(() => (window as unknown as { tooltipNameAudit: { seen: number; unnamed: string[]; retiredNamed: number } }).tooltipNameAudit);
  expect(audit.seen).toBeGreaterThan(0);
  expect(audit.unnamed).toEqual([]);
});
