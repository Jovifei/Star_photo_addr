import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  installGeocodingMock,
  installNextApiMock,
  installOpenMeteoMock,
} from "../tests/e2e/mock-open-meteo.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(
  readFileSync(resolve(root, "tests/e2e/fixtures/open-meteo.json"), "utf8"),
);
const outputDir = resolve(root, "docs/images/readme");
const baseURL =
  process.env.README_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:3100";

mkdirSync(outputDir, { recursive: true });

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

const healthySources = {
  status: "ok",
  checkedAt: new Date().toISOString(),
  cached: false,
  sources: {
    weather: {
      id: "weather",
      label: "天气 / Open-Meteo",
      status: "available",
      detail: "总云量、低云、中云和高云字段可用",
      checkedAt: new Date().toISOString(),
    },
    satellite: {
      id: "satellite",
      label: "卫星 / NASA GIBS",
      status: "available",
      detail: "Himawari 云图目录可用",
      checkedAt: new Date().toISOString(),
    },
    "light-pollution": {
      id: "light-pollution",
      label: "光污染参考 / VIIRS 2023",
      status: "available",
      detail: "夜光视觉参考可用",
      checkedAt: new Date().toISOString(),
    },
    tianditu: {
      id: "tianditu",
      label: "中文注记 / 天地图",
      status: "unconfigured",
      detail: "演示环境使用内置中文注记",
      checkedAt: new Date().toISOString(),
    },
    "local-dark-sky": {
      id: "local-dark-sky",
      label: "Bortle / SQM 本地栅格",
      status: "not-installed",
      detail: "未安装授权本地栅格，不生成虚假等级",
      checkedAt: new Date().toISOString(),
    },
  },
};

function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function installScreenshotRoutes(page) {
  await installOpenMeteoMock(page, fixture);
  await installGeocodingMock(page);
  await installNextApiMock(page, fixture);

  await page.route("**/api/data-status**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(healthySources),
    }),
  );
  await page.route("**/api/data-sources/health**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify(healthySources),
    }),
  );
  await page.route("**/api/air-quality?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ hourly: [] }),
    }),
  );
  await page.route("**/api/space-weather/kp**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ frames: [] }),
    }),
  );

  // The deterministic satellite fixture points to gibs.test. Return a tiny
  // valid image so Leaflet completes tile loading without external dependence.
  await page.route("https://gibs.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: onePixelPng,
    }),
  );
}

async function stabilize(page) {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `,
  });
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(1200);
}

async function createPage(browser, options) {
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: 1,
    isMobile: options.isMobile ?? false,
    hasTouch: options.hasTouch ?? false,
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
  });
  const page = await context.newPage();
  await installScreenshotRoutes(page);
  return { context, page };
}

async function save(page, filename) {
  await page.screenshot({
    path: resolve(outputDir, filename),
    type: "jpeg",
    quality: 88,
    animations: "disabled",
    caret: "hide",
    scale: "css",
    fullPage: false,
  });
}

const locationQuery =
  "lat=30.4694&lng=119.5978&name=" +
  encodeURIComponent("天荒坪") +
  "&elevation=958.4&model=gfs";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  {
    const { context, page } = await createPage(browser, {
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(
      `${baseURL}/?${locationQuery}&view=combined&overlay=forecast-cloud`,
      { waitUntil: "domcontentloaded" },
    );
    await page.locator(".map-stage").waitFor({ state: "visible" });
    await page.locator(".cloud-control").waitFor({ state: "visible" });
    await page.locator(".source-status-panel").waitFor({ state: "visible" });
    // A location passed through the URL intentionally opens the detail panel.
    // Do not click controls behind that panel; the screenshot should show the
    // real map/detail composition without forcing pointer events through it.
    await stabilize(page);
    await save(page, "01-tonight-observation.jpg");
    await context.close();
  }

  {
    const { context, page } = await createPage(browser, {
      viewport: { width: 1440, height: 1000 },
    });
    await page.goto(`${baseURL}/sites?${locationQuery}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".map-stage").waitFor({ state: "visible" });
    await page.waitForFunction(() =>
      document.querySelector(".detail-overlay-host")?.classList.contains("is-open"),
    );
    const tabs = page.locator('.cloud-tabs[role="tablist"] [role="tab"]');
    if ((await tabs.count()) >= 3) {
      await tabs.nth(2).click({ force: true });
      await tabs.nth(2).waitFor({ state: "visible" });
    }
    await stabilize(page);
    await save(page, "02-dark-sky-selection.jpg");
    await context.close();
  }

  {
    const { context, page } = await createPage(browser, {
      viewport: { width: 1440, height: 1000 },
    });
    const night = shanghaiDateKey();
    await page.goto(
      `${baseURL}/planner?${locationQuery}&night=${night}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.locator(".planner-root").waitFor({ state: "visible" });
    await page.locator(".hero-card").waitFor({ state: "visible" });
    await page.locator(".detail-drawer").waitFor({ state: "visible" });
    await stabilize(page);
    await save(page, "03-observation-plan.jpg");
    await context.close();
  }

  {
    const { context, page } = await createPage(browser, {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(
      `${baseURL}/?${locationQuery}&view=combined&overlay=forecast-cloud`,
      { waitUntil: "domcontentloaded" },
    );
    await page.locator(".map-stage").waitFor({ state: "visible" });
    await stabilize(page);
    await save(page, "04-mobile-overview.jpg");
    await context.close();
  }

  console.log(`README screenshots written to ${outputDir}`);
} finally {
  await browser.close();
}
