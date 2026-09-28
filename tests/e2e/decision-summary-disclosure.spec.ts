import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
import { installGeocodingMock, installNextApiMock, installOpenMeteoMock } from "./mock-open-meteo.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"));
const selectedForecastUrl = "/?lat=30.4694&lng=119.5978&name=%E5%A4%A9%E8%8D%92%E5%9D%AA&model=icon&overlay=forecast-cloud";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);
});

for (const project of ["mobile", "desktop"] as const) {
  test(`${project}: DecisionSummary keeps trust visible and provenance progressive`, async ({ page }, info) => {
    test.skip(info.project.name !== project, `${project} disclosure contract runs in its project`);
    await page.setViewportSize(project === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 });
    await page.goto(selectedForecastUrl);

    if (project === "mobile") await expandMobileDataSheet(page);
    const card = page.getByTestId("observation-reason-card");
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card).toContainText("最佳窗口");
    await expect(card).toContainText("更新时间");

    const trust = page.getByTestId("forecast-trust-summary");
    await expect(trust).toBeVisible();
    const evidence = page.getByTestId("forecast-evidence-details");
    await expect(evidence).toHaveCount(1);
    await expect(evidence).not.toHaveAttribute("open", "");
    await expect(evidence.locator(".decision-summary-evidence-grid")).toBeHidden();
    await expect(page.getByTestId("observation-provenance")).toHaveCount(0);

    await evidence.locator("summary").click();
    await expect(evidence).toHaveAttribute("open", "");
    await expect(evidence).toContainText("请求坐标");
    await expect(evidence).toContainText("模型网格");
    await expect(evidence).toContainText("原始抓取");
    if (project === "mobile") {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth + 1),
      );
    }
    await evidence.locator("summary").click();
    await expect(evidence).not.toHaveAttribute("open", "");
  });
}
