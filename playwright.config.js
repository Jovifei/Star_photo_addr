import { defineConfig, devices } from "@playwright/test";

// E2E runs against the lightweight `preview` static server (built dist) rather
// than `dev`: this environment OOM-panics Vite's esbuild during dev dependency
// pre-bundling, so the static preview is the stable choice. `npm run build`
// runs first (with a constrained heap) to guarantee dist/ exists.
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "node_modules/.cache/playwright-results",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4178",
    screenshot: "only-on-failure",
    trace: "off",
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
    command: "npm run build && npm run preview:test",
    url: "http://localhost:4178",
    reuseExistingServer: true,
    timeout: 180000,
    env: { NODE_OPTIONS: "--max-old-space-size=2048" },
  },
});
