import { defineConfig, devices } from "@playwright/test";

// Local E2E override: reuse the already-built .next/standalone instead of
// rebuilding inside webServer (the default config times out because a cold
// Next.js build exceeds its 180s webServer budget).
const PORT = process.env.PORT || "3100";
const BASE_URL = `http://127.0.0.1:${PORT}`;

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "node_modules/.cache/playwright-results-local",
  preserveOutput: "failures-only",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-local", open: "never" }],
  ],
  use: {
    baseURL: BASE_URL,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    launchOptions: chromiumExecutable
      ? {
          executablePath: chromiumExecutable,
          args: [
            "--single-process",
            "--no-zygote",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-site-isolation-trials",
            "--disable-features=AudioServiceOutOfProcess,IsolateOrigins,site-per-process",
            "--in-process-gpu",
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        }
      : undefined,
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    command: "npm run start:e2e",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      NODE_OPTIONS: "--max-old-space-size=2048",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT,
    },
  },
});
