import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Minimal vitest config: only maps the project's `@/*` path alias (from
// tsconfig.json) so that `src/lib/*` and `src/data/*` imports resolve under
// node. No other project config (Next/TS) is touched.
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
      "tests/planner/**/*.test.js",
      "src/**/*.test.ts",
    ],
  },
});
