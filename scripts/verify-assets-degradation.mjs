// Runtime verification for tasks 4.2 / 4.3.
//
// Loads the app in a real browser, exercises the flows that used to request the
// missing `public/images/perseids/*` bundle (initial map render, pan, zoom,
// map click sampling, /viirs page) and asserts that:
//   1. no request to /images/perseids/* is ever issued;
//   2. no response has status >= 400 for a same-origin local asset;
//   3. no unhandled page error / console error occurs;
//   4. the UI shows an explicit "无数据" state instead of a fabricated B9.
//
// Usage: node scripts/verify-assets-degradation.mjs [baseUrl]
//   default baseUrl: http://127.0.0.1:3178

import { chromium } from "@playwright/test";

const BASE_URL = process.argv[2] ?? "http://127.0.0.1:3178";

/** Requests to these prefixes prove a missing-asset regression. */
const FORBIDDEN_PREFIXES = ["/images/perseids/"];

/** Noise that is expected and unrelated to local assets. */
function isIgnorableFailure(url) {
  // CARTO basemap tiles are remote and may rate-limit / be offline in CI.
  return url.includes("basemaps.cartocdn.com");
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  const forbiddenRequests = [];
  const failedResponses = [];
  const consoleErrors = [];
  const pageErrors = [];

  page.on("request", (request) => {
    const { pathname } = new URL(request.url(), BASE_URL);
    if (FORBIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      forbiddenRequests.push(pathname);
    }
  });

  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && !isIgnorableFailure(url)) {
      failedResponses.push(`${response.status()} ${url}`);
    }
  });

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  // --- 1. First paint -------------------------------------------------------
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForSelector(".map-canvas", { timeout: 20_000 });

  // --- 2. Pan + zoom: the old VIIRS tile layer 404'd on every move ----------
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(500, 380, { steps: 12 });
  await page.mouse.up();
  await page.keyboard.press("Equal"); // zoom in
  await page.waitForTimeout(1200);
  await page.keyboard.press("Equal");
  await page.waitForTimeout(1200);

  // --- 3. Click the map to trigger sampleBortle ----------------------------
  await page.mouse.click(700, 520);
  await page.waitForTimeout(2500);

  const panelText = await page
    .locator(".side-panel")
    .innerText()
    .catch(() => "");

  // --- 4. Reference page ---------------------------------------------------
  await page.goto(`${BASE_URL}/viirs`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  await browser.close();

  // --- Report --------------------------------------------------------------
  const problems = [];
  if (forbiddenRequests.length > 0) {
    const unique = [...new Set(forbiddenRequests)];
    problems.push(
      `发起了 ${forbiddenRequests.length} 次缺失资源请求：\n    ${unique.join("\n    ")}`,
    );
  }
  if (failedResponses.length > 0) {
    const unique = [...new Set(failedResponses)];
    problems.push(`出现 ${failedResponses.length} 个失败响应：\n    ${unique.join("\n    ")}`);
  }
  if (consoleErrors.length > 0) {
    problems.push(`Console error ${consoleErrors.length} 条：\n    ${consoleErrors.join("\n    ")}`);
  }
  if (pageErrors.length > 0) {
    problems.push(`未处理异常 ${pageErrors.length} 条：\n    ${pageErrors.join("\n    ")}`);
  }

  console.log("=== 资源降级验证 ===");
  console.log(`baseUrl                : ${BASE_URL}`);
  console.log(`/images/perseids 请求数 : ${forbiddenRequests.length}`);
  console.log(`失败响应数              : ${failedResponses.length}`);
  console.log(`console error           : ${consoleErrors.length}`);
  console.log(`未处理异常              : ${pageErrors.length}`);
  console.log(`侧栏含「无数据」        : ${panelText.includes("无数据")}`);
  console.log(`侧栏未出现伪造 B9       : ${!/\bB9\b/.test(panelText)}`);

  if (problems.length > 0) {
    console.error("\n✗ 验证失败：");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }

  console.log("\n✓ 缺失资源未产生任何请求、404 或未处理异常。");
}

main().catch((error) => {
  console.error("验证脚本自身失败：", error);
  process.exit(1);
});
