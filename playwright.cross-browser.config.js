import { defineConfig, devices } from "@playwright/test";
import baseConfig from "./playwright.config.js";

export default defineConfig(baseConfig, {
  testMatch: /cross-browser-smoke\.spec\.(?:js|ts)$/,
  outputDir: "node_modules/.cache/playwright-results-cross-browser",
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "playwright-report-cross-browser", open: "never" },
    ],
  ],
  projects: [
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1366, height: 900 },
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
      },
    },
  ],
});
