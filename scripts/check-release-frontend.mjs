import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// Health revision alone cannot prove that a layered image serves this build.
// Compare the actual prerendered response with its packaged artifact.
const root = process.argv[2] ?? "/app";
const base = process.env.RELEASE_CHECK_BASE_URL ?? "http://127.0.0.1:3000";
const digest = (value) => createHash("sha256").update(value).digest("hex");
for (const [route, artifact] of [["/", "index"], ["/fireglow", "fireglow"], ["/cloudsea", "cloudsea"]]) {
  const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Frontend ${route}: HTTP ${response.status}`);
  const served = await response.text();
  const packaged = readFileSync(resolve(root, ".next/server/app", `${artifact}.html`), "utf8");
  const matches = digest(served) === digest(packaged);
  console.log(JSON.stringify({ route, matches, servedSHA: digest(served), packagedSHA: digest(packaged) }));
  if (!matches) throw new Error(`Frontend ${route} differs from the packaged build`);
}
