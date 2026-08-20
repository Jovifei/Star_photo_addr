import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Node-based test runner for pure logic, provider contracts and direct Next.js
// route integration. Browser component/E2E coverage remains in Playwright.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/contract/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/planner/**/*.test.js",
      "src/**/*.test.ts",
    ],
  },
});
