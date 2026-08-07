import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Legacy Vite star-weather source (not part of the Next build; do not lint).
    "src/App.jsx",
    "src/main.jsx",
    "src/styles.css",
    "src/lib/openMeteo.js",
    "src/lib/scoring.js",
    "src/lib/astronomy.js",
    "src/lib/clouds.js",
    "src/lib/time.js",
    "src/lib/cache.js",
    "src/data/locations.js",
    // Legacy / non-Next directories that generate thousands of warnings and
    // are not part of the Next build.
    "tests/**",
    "_oldsite_vite/**",
    "scripts/**",
    "_tpl/**",
    "_broken_git/**",
  ]),
]);

export default eslintConfig;
