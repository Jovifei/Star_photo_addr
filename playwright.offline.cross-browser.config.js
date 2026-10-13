import { defineConfig } from "@playwright/test";
import offline from "./playwright.offline.config.js";
import crossBrowser from "./playwright.cross-browser.config.js";

export default defineConfig({
  ...offline,
  testMatch: crossBrowser.testMatch,
  projects: crossBrowser.projects,
  // A Chromium executable must never be inherited by Firefox or WebKit.
  use: { ...offline.use, launchOptions: undefined },
});
