import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const root = process.cwd();
const standalone = resolve(root, ".next/standalone");
if (!existsSync(resolve(standalone, "server.js"))) {
  throw new Error("缺少 .next/standalone/server.js，请先运行 npm run build");
}

cpSync(resolve(root, ".next/static"), resolve(standalone, ".next/static"), {
  recursive: true,
});
cpSync(resolve(root, "public"), resolve(standalone, "public"), {
  recursive: true,
});

process.env.HOSTNAME ||= "127.0.0.1";
process.env.PORT ||= "3100";

// Run the standalone server in this process. On Windows, Playwright stopping a
// shell command does not reliably terminate a grandchild spawned by this
// script, which used to leave the E2E port occupied and keep the runner alive.
// Keeping Next in the webServer process gives Playwright one process tree to
// own and makes the command exit status authoritative.
const require = createRequire(import.meta.url);
require(resolve(standalone, "server.js"));
