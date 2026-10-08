import { expect, test } from "@playwright/test";
import { expandMobileDataSheet } from "./mobile-data-sheet.js";
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

test("an unsupported incoming date remains in peer links until a topic date is explicitly chosen", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 502, json: { error: "fixture: no supplier request" } }));
  await page.goto("/fireglow?contextVersion=2&lat=31.2&lng=121.5&name=自定义点位&night=2030-01-02");
  await expect(page.getByRole("link", { name: /^云海/ })).toHaveAttribute("href", /night=2030-01-02/);
  await expect(page.getByText(/跨入口保留原日期/)).toBeVisible();
  await page.getByRole("button", { name: /明日/ }).click();
  await expect(page.getByRole("link", { name: /^云海/ })).not.toHaveAttribute("href", /night=2030-01-02/);
  await expect(page.getByText(/跨入口保留原日期/)).toHaveCount(0);
});

test("a home round-trip retains the source scope and source ID when the selected coordinates still match", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 502, json: { error: "fixture: no supplier request" } }));
  await page.goto("/?contextVersion=2&lat=29.782&lng=102.582&name=雅安牛背山&sourceScope=observing&sourceId=finder-147-location&canonicalId=observing%3Afinder-147-location&night=2026-10-08&phase=morning&forecastTime=2026-10-08T05%3A00");
  const fireglow = page.getByRole("link", { name: /^火烧云/ });
  await expect(fireglow).toHaveAttribute("href", /lat=29.782.*lng=102.582/);
  await expect(fireglow).toHaveAttribute("href", /sourceScope=observing.*sourceId=finder-147-location/);
  await expect(fireglow).toHaveAttribute("href", /canonicalId=observing%3Afinder-147-location/);
  await expect(fireglow).toHaveAttribute("href", /night=2026-10-08/);
  await expect(fireglow).toHaveAttribute("href", /phase=morning/);
});

test("a versioned unsupported home date is retained without substituting today's forecast context", async ({ page }) => {
  await page.route("**/api/**", route => route.fulfill({ status: 502, json: { error: "fixture: no supplier request" } }));
  await page.goto("/?contextVersion=2&lat=31.2&lng=121.5&name=自定义点位&night=2030-01-02&forecastTime=2030-01-02T20%3A00");
  const fireglow = page.getByRole("link", { name: /^火烧云/ });
  await expect(fireglow).toHaveAttribute("href", /lat=31.2.*lng=121.5/);
  await expect(fireglow).toHaveAttribute("href", /night=2030-01-02/);
  await expect(fireglow).toHaveAttribute("href", /forecastTime=2030-01-02T20%3A00/);
});

test("selected model survives both topic requests and the home return link", async ({ page }) => {
  const requests: string[] = [];
  await page.route("**/api/**", route => {
    requests.push(route.request().url());
    return route.fulfill({ status: 502, json: { error: "fixture no supplier" } });
  });
  await page.goto("/fireglow?contextVersion=2&lat=31.2&lng=121.5&model=gfs");
  await expect.poll(() => requests.filter(url => url.includes("/api/fireglow/snapshot")).length).toBeGreaterThan(0);
  expect(requests.filter(url => url.includes("/api/fireglow/snapshot")).every(url => new URL(url).searchParams.get("model") === "gfs")).toBe(true);
  await expect(page.getByRole("link", { name: /^云海/ })).toHaveAttribute("href", /model=gfs/);
  await page.getByRole("link", { name: /^云海/ }).click();
  await expect.poll(() => requests.filter(url => url.includes("/api/cloudsea/snapshot")).length).toBeGreaterThan(0);
  expect(requests.filter(url => url.includes("/api/cloudsea/snapshot")).every(url => new URL(url).searchParams.get("model") === "gfs")).toBe(true);
  await expect(page.getByRole("link", { name: /^今夜观测/ })).toHaveAttribute("href", /model=gfs/);
});

test("cloudsea stops retries and later dates on provider cooldown", async ({ page }, testInfo) => {
  let calls = 0;
  await page.route("**/api/cloudsea/snapshot**", route => {
    calls += 1;
    return route.fulfill({ status: 429, headers: { "Retry-After": "600" }, json: { error: "fixture provider cooldown" } });
  });
  await page.goto("/cloudsea");
  if (testInfo.project.name === "mobile") await expandMobileDataSheet(page);
  const evidence = testInfo.project.name === "mobile"
    ? page.getByTestId("mobile-data-sheet").getByRole("status")
    : page.getByTestId("cloudsea-evidence-status");
  await expect(evidence).toContainText("fixture provider cooldown");
  await expect(evidence).toBeVisible();
  // The UI has processed the error; no timer-based retry is permitted.
  await page.waitForTimeout(700);
  expect(calls).toBe(1);
});
