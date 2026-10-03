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
    violation.impact === "serious" || violation.impact === "critical",
  );
  expect(blockers.map(({ id, impact, help, helpUrl, nodes }) => ({
    id, impact, help, helpUrl,
    nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
  })), `Serious/critical accessibility violations in ${state}; see complete axe attachment`).toEqual([]);
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
