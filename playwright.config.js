import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// E2E runs against the production Next.js server. This exercises App Router
// navigation and the same-origin /api routes instead of the removed Vite
// static preview.
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "node_modules/.cache/playwright-results",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    screenshot: "only-on-failure",
    trace: "off",
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
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 } },
    },
  ],
  webServer: {
    command: "npm run build && npm run start:e2e",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 180000,
    env: {
      NODE_OPTIONS: "--max-old-space-size=2048",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: "3000",
    },
  },
});
