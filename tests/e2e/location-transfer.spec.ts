import { expect, test } from "@playwright/test";
test("only the relevant Niubeishan transfer reports a coordinate conflict and keeps the selected coordinate", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 502, json: { error: "fixture: no supplier request" } }));
  await page.goto("/fireglow?contextVersion=2&lat=29.782&lng=102.582&name=雅安牛背山&sourceScope=observing&sourceId=finder-147-location&night=2026-10-08");
  await expect(page.getByTestId("location-transfer-conflict")).toHaveCount(0);
  const cloudsea = page.getByRole("link", { name: /^云海/ });
  await expect(cloudsea).toHaveAttribute("href", /lat=29.782.*lng=102.582/);
  await cloudsea.click();
  await expect(page.getByTestId("location-transfer-conflict")).toContainText("未自动合并");
  const outgoing = new URL(await page.getByRole("link", { name: /^今夜观测/ }).getAttribute("href") ?? "", "http://localhost");
  expect(outgoing.searchParams.get("lat")).toBe("29.782");
  expect(outgoing.searchParams.get("lng")).toBe("102.582");
  expect(outgoing.searchParams.get("night")).toBe("2026-10-08");
});
test("an unrelated custom coordinate does not show catalogue conflicts", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 502, json: { error: "fixture: no supplier request" } }));
  await page.goto("/cloudsea?contextVersion=2&lat=31.2&lng=121.5&name=自定义点位");
  await expect(page.getByRole("link", { name: /^火烧云/ })).toHaveAttribute("href", /lat=31.2/);
  await expect(page.getByTestId("location-transfer-conflict")).toHaveCount(0);
});
