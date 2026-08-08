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
    // Generated output is never source input.
    "dist/**",
    "next-env.d.ts",
    // Tests and local orchestration have their own runtime checks.
    "tests/**",
    "scripts/**",
    "_tpl/**",
    "_broken_git/**",
    // Local AI agent / editor tool directories (mirrors .gitignore).
    // Flat config does not read .gitignore, and these ship bundled/obfuscated
    // scripts that are never product source — keep local lint parity with CI.
    ".claude/**",
    ".codex/**",
    ".qoder/**",
    ".agents/**",
    ".comet/**",
    ".workbuddy/**",
    "openspec/**",
    ".github/skills/**",
    "AGENTS.md",
    "CLAUDE.md",
    "skills-lock.json",
  ]),
]);

export default eslintConfig;
