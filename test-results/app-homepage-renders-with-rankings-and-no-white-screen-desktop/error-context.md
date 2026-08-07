# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.js >> homepage renders with rankings and no white screen
- Location: tests\e2e\app.spec.js:57:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.rank-card').first()
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 20000ms
  - waiting for locator('.rank-card').first()

```

```yaml
- banner:
  - img
  - paragraph: ASTRO WEATHER
  - heading "星野决策" [level=1]
  - navigation "主导航":
    - button "今晚":
      - img
      - text: 今晚
    - button "对比":
      - img
      - text: 对比
    - button "点位":
      - img
      - text: 点位
  - button "刷新":
    - img
    - text: 刷新
- main:
  - region "预测范围与摄影模式":
    - button "7 天"
    - button "14 天"
    - button "星空":
      - img
      - text: 星空
    - button "云海":
      - img
      - text: 云海
    - text: 尚未更新
  - img
  - heading "还没有天气数据" [level=2]
  - paragraph: 连接网络后刷新，页面会保留最近一次成功数据。
  - button "立即刷新"
- contentinfo:
  - text: 天气数据：
  - link "Open-Meteo":
    - /url: https://open-meteo.com/
  - text: 天文计算：Astronomy Engine 预测用于摄影规划，不替代现场安全判断
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   | import { readFileSync } from "node:fs";
  3   | import { mkdirSync } from "node:fs";
  4   | import { resolve } from "node:path";
  5   | import { installOpenMeteoMock } from "./mock-open-meteo.js";
  6   | 
  7   | const fixture = JSON.parse(
  8   |   readFileSync(new URL("./fixtures/open-meteo.json", import.meta.url), "utf8"),
  9   | );
  10  | 
  11  | const DATE = "2026-08-06";
  12  | const QA_DIR = resolve(process.cwd(), "docs/qa");
  13  | mkdirSync(QA_DIR, { recursive: true });
  14  | 
  15  | function vp(page) {
  16  |   return (page.viewportSize()?.width ?? 1280) < 768 ? "mobile" : "desktop";
  17  | }
  18  | function navScope(page) {
  19  |   return vp(page) === "mobile" ? ".mobile-nav" : ".desktop-nav";
  20  | }
  21  | function navButton(page, label) {
  22  |   return page.locator(`${navScope(page)} button`, { hasText: label });
  23  | }
  24  | async function shot(page, name) {
  25  |   await page.screenshot({
  26  |     path: resolve(QA_DIR, `${DATE}-${vp(page)}-${name}.jpg`),
  27  |     type: "jpeg",
  28  |     quality: 72,
  29  |   });
  30  | }
  31  | 
  32  | test.beforeEach(async ({ page }) => {
  33  |   const consoleErrors = [];
  34  |   const pageErrors = [];
  35  |   const failedExternal = [];
  36  |   page.on("console", (msg) => {
  37  |     if (msg.type() === "error") consoleErrors.push(msg.text());
  38  |   });
  39  |   page.on("pageerror", (err) => pageErrors.push(err.message));
  40  |   page.on("requestfailed", (req) => {
  41  |     const u = req.url();
  42  |     if (u.includes("localhost") || u.includes("api.open-meteo.com")) return;
  43  |     failedExternal.push(u);
  44  |   });
  45  |   await installOpenMeteoMock(page, fixture);
  46  |   page.__qa = { consoleErrors, pageErrors, failedExternal };
  47  | });
  48  | 
  49  | test.afterEach(async ({ page }, testInfo) => {
  50  |   if (testInfo.status !== "passed") return; // screenshots on failure handled by config
  51  |   const { consoleErrors, pageErrors, failedExternal } = page.__qa;
  52  |   expect(pageErrors, `pageErrors: ${pageErrors.join(" | ")}`).toEqual([]);
  53  |   expect(consoleErrors, `consoleErrors: ${consoleErrors.join(" | ")}`).toEqual([]);
  54  |   expect(failedExternal, `failedExternal: ${failedExternal.join(" | ")}`).toEqual([]);
  55  | });
  56  | 
  57  | test("homepage renders with rankings and no white screen", async ({ page }) => {
  58  |   await page.goto("/");
> 59  |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
      |                                                    ^ Error: expect(locator).toBeVisible() failed
  60  |   await expect(page.locator("h1")).toHaveText("星野决策");
  61  |   await shot(page, "dashboard");
  62  | });
  63  | 
  64  | test("7天 / 14天 toggle switches active range", async ({ page }) => {
  65  |   await page.goto("/");
  66  |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  67  |   const btn14 = page.getByRole("button", { name: "14 天" });
  68  |   const btn7 = page.getByRole("button", { name: "7 天" });
  69  |   await btn14.click();
  70  |   await expect(btn14).toHaveClass(/active/);
  71  |   await btn7.click();
  72  |   await expect(btn7).toHaveClass(/active/);
  73  | });
  74  | 
  75  | test("星空 / 云海 mode toggle switches active and labels", async ({ page }) => {
  76  |   await page.goto("/");
  77  |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  78  |   const cloud = page.getByRole("button", { name: "云海" });
  79  |   await cloud.click();
  80  |   await expect(cloud).toHaveClass(/active/);
  81  |   await expect(page.getByText("点位云海潜力")).toBeVisible();
  82  |   await shot(page, "cloud-mode");
  83  |   const star = page.getByRole("button", { name: "星空" });
  84  |   await star.click();
  85  |   await expect(star).toHaveClass(/active/);
  86  | });
  87  | 
  88  | test("navigation between 今晚 / 对比 / 点位", async ({ page }) => {
  89  |   await page.goto("/");
  90  |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  91  |   await navButton(page, "对比").click();
  92  |   await expect(page.locator(".matrix-section")).toBeVisible();
  93  |   await shot(page, "matrix");
  94  |   await navButton(page, "点位").click();
  95  |   await expect(page.locator(".locations-section")).toBeVisible();
  96  |   await navButton(page, "今晚").click();
  97  |   await expect(page.locator(".rank-card").first()).toBeVisible();
  98  | });
  99  | 
  100 | test("observation night switching updates selection", async ({ page }) => {
  101 |   await page.goto("/");
  102 |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  103 |   const rail = page.locator(".night-rail button");
  104 |   const count = await rail.count();
  105 |   expect(count).toBeGreaterThan(1);
  106 |   await rail.nth(1).click();
  107 |   await expect(rail.nth(1)).toHaveClass(/active/);
  108 | });
  109 | 
  110 | test("detail drawer opens, Esc closes, body scroll locked", async ({ page }) => {
  111 |   await page.goto("/");
  112 |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  113 |   await page.locator(".rank-card").first().click();
  114 |   const drawer = page.locator(".detail-drawer");
  115 |   await expect(drawer).toBeVisible({ timeout: 10000 });
  116 |   await expect(page.locator(".drawer-backdrop")).toBeVisible();
  117 |   const overflowOpen = await page.evaluate(() => document.body.style.overflow);
  118 |   expect(overflowOpen).toBe("hidden");
  119 |   await shot(page, "drawer");
  120 |   await page.keyboard.press("Escape");
  121 |   await expect(drawer).toBeHidden({ timeout: 10000 });
  122 |   const overflowClosed = await page.evaluate(() => document.body.style.overflow);
  123 |   expect(overflowClosed).not.toBe("hidden");
  124 | });
  125 | 
  126 | test("detail drawer opens from matrix cell", async ({ page }) => {
  127 |   await page.goto("/");
  128 |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  129 |   await navButton(page, "对比").click();
  130 |   await expect(page.locator(".matrix-cell").first()).toBeVisible({ timeout: 10000 });
  131 |   await page.locator(".matrix-cell").first().click();
  132 |   await expect(page.locator(".detail-drawer")).toBeVisible({ timeout: 10000 });
  133 |   await page.keyboard.press("Escape");
  134 |   await expect(page.locator(".detail-drawer")).toBeHidden({ timeout: 10000 });
  135 | });
  136 | 
  137 | test("custom location form validates empty and saves valid", async ({ page }) => {
  138 |   await page.goto("/");
  139 |   await expect(page.locator(".rank-card").first()).toBeVisible({ timeout: 20000 });
  140 |   await navButton(page, "点位").click();
  141 |   await expect(page.locator(".locations-section")).toBeVisible();
  142 |   const rowsBefore = await page.locator(".location-table tbody tr").count();
  143 | 
  144 |   await page.getByRole("button", { name: "新增点位" }).click();
  145 |   await expect(page.locator(".location-form")).toBeVisible();
  146 |   await shot(page, "location-form");
  147 |   // empty submit must be blocked
  148 |   await page.getByRole("button", { name: "保存点位" }).click();
  149 |   await expect(page.locator(".location-form")).toBeVisible();
  150 |   expect(await page.locator(".location-table tbody tr").count()).toBe(rowsBefore);
  151 | 
  152 |   // valid submit
  153 |   await page.getByPlaceholder("例如：东白山").fill("测试山");
  154 |   await page.getByPlaceholder("29.5000").fill("29.5");
  155 |   await page.getByPlaceholder("120.3000").fill("120.3");
  156 |   await page.getByPlaceholder("1000").fill("1000");
  157 |   await page.getByRole("button", { name: "保存点位" }).click();
  158 |   await expect(page.locator(".status-banner")).toContainText("新点位已保存到本机");
  159 |   const rowsAfter = await page.locator(".location-table tbody tr").count();
```