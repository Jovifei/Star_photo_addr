import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.E2E_OFFLINE_OUTPUT_DIR || "node_modules/.cache/offline-e2e");
mkdirSync(root, { recursive: true });
const guard = resolve("scripts/offline-network-guard.cjs").replaceAll("\\", "/");
const args = process.argv.slice(2);
const crossBrowser = args.includes("--cross-browser");
const result = spawnSync(process.execPath, [
  resolve("node_modules/@playwright/test/cli.js"), "test",
  `--config=playwright.offline${crossBrowser ? ".cross-browser" : ""}.config.js`,
  ...args.filter(arg => arg !== "--cross-browser"),
], {
  stdio: "inherit",
  env: {
    ...process.env,
    E2E_OFFLINE: "1",
    E2E_OFFLINE_OUTPUT_DIR: root,
    E2E_OFFLINE_AUDIT: resolve(root, "server-egress.jsonl"),
    NODE_OPTIONS: `--max-old-space-size=2048 --require="${guard}"`,
  },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
