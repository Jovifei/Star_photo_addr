import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const worker = fileURLToPath(new URL("../../scripts/observing-snapshot-worker.mjs", import.meta.url));
const fixture = new URL("./worker-fetch-mock.mjs", import.meta.url).href;
function runWorker(scenario, enabled = "0") {
  const env = { ...process.env, RECOVERY_WORKER_SCENARIO: scenario, SNAPSHOT_PREWARM_FIREGLOW: enabled };
  delete env.SNAPSHOT_MODEL;
  delete env.SNAPSHOT_BASE_URL;
  const result = spawnSync(process.execPath, ["--import", fixture, worker], { env, encoding: "utf8", timeout: 5000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const match = result.stdout.match(/RECOVERY_REQUESTS=(.*)/);
  assert.ok(match, result.stdout);
  return JSON.parse(match[1]);
}
export const workerCases = [
  ["worker runtime defaults to GFS and leaves fireglow off", () => {
    const calls = runWorker("fresh");
    assert.equal(calls.length, 1); assert.equal(calls[0].model, "gfs");
  }],
  ["non-429 HTTP failure suppresses optional topic prewarm", () => assert.equal(runWorker("failure", "1").length, 1)],
  ["stale response suppresses optional topic prewarm", () => assert.equal(runWorker("stale", "1").length, 1)],
  ["wrong-model response suppresses optional topic prewarm", () => assert.equal(runWorker("wrong-model", "1").length, 1)],
  ["explicit topic opt-in executes a serial three-date cycle", () => {
    const calls = runWorker("fresh", "1");
    assert.equal(calls.length, 4);
    assert.deepEqual(calls.slice(1).map((x) => x.path), Array(3).fill("/api/fireglow/snapshot"));
    assert.equal(new Set(calls.slice(1).map((x) => x.date)).size, 3);
  }],
  ["topic cycle stops immediately after its first failure", () => assert.equal(runWorker("topic-failure", "1").length, 2)],
];
