import { defineConfig, devices } from "@playwright/test";

const chromiumExecutable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

// Keep E2E on the app's reserved local port. The server is never reused: a
// successful HTTP response alone must not make another local app look like this project.
const PORT = process.env.PORT || "3100";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "node_modules/.cache/playwright-results",
  preserveOutput: "failures-only",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
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
    // Start the prebuilt standalone server only. A cold `next build` inside
    // the webServer cannot fit in any sane timeout (it takes ~4 minutes
    // locally and more on CI runners), which made every e2e job die before
    // running a single test. Build first (CI has a dedicated step; locally
    // run `npm run build` once), then boot the server here.
    command: "npm run start:e2e",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NODE_OPTIONS: "--max-old-space-size=2048",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT,
    },
  },
});
