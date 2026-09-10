import { expect, test } from "@playwright/test";

test("主页搜索可以命中本地点位目录中的太子尖", async ({ page }) => {
  await page.route("**/geocoding-api.open-meteo.com/v1/search**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [] }),
    });
  });

  await page.goto("/?overlay=forecast-cloud&view=combined");
  const search = page.getByRole("combobox", { name: "搜索地点、城市或观测点" });
  await search.fill("太子尖");

  const suggestions = page.locator(".suggestions");
  await expect(suggestions).toBeVisible();
  await expect(suggestions).toContainText("临安太子尖", { timeout: 15000 });
  await expect(suggestions).toContainText("浙江");
  await expect(suggestions.locator(".empty")).toHaveCount(0);
});
