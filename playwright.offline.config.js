import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import config from "./playwright.config.js";

if (process.env.E2E_OFFLINE !== "1") throw new Error("Use npm run test:e2e:offline");
const root = resolve(process.env.E2E_OFFLINE_OUTPUT_DIR || "node_modules/.cache/offline-e2e");
export default defineConfig({
  ...config,
  outputDir: resolve(root, "results"),
  reporter: [
    ["list"],
    ["json", { outputFile: resolve(root, "results.json") }],
    ["html", { outputFolder: resolve(root, "html"), open: "never" }],
  ],
  use: { ...config.use, serviceWorkers: "block" },
  webServer: {
    ...config.webServer,
    command: "node scripts/start-e2e.mjs",
    env: { ...config.webServer.env, E2E_OFFLINE: "1", NODE_OPTIONS: process.env.NODE_OPTIONS },
  },
});
