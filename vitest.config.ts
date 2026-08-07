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
    // Prefer TypeScript sources over legacy Vite `.js` twins in `src/lib/`
    // (e.g. scoring.ts vs scoring.js) so `@/lib/*` resolves to the Next.js
    // implementation rather than the old Vite module.
    extensions: [".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".json"],
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
  },
});
