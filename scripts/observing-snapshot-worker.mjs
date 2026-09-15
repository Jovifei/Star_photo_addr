import {
  nextWorkerDelay,
  observingContext,
  snapshotHealth,
  workerRetryAfterMs,
} from "./observing-snapshot-worker-utils.mjs";

const baseUrl = (process.env.SNAPSHOT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
function boundedNumber(value, fallback, minimum, maximum) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, Math.round(parsed))) : fallback;
}
const intervalMs = boundedNumber(process.env.SNAPSHOT_INTERVAL_MS, 3 * 60 * 60_000, 60_000, 24 * 60 * 60_000);
const requestTimeoutMs = boundedNumber(process.env.SNAPSHOT_WORKER_REQUEST_TIMEOUT_MS, 150_000, 10_000, 5 * 60_000);
const daysValue = Number(process.env.SNAPSHOT_DAYS);
const days = [1, 3, 5, 7].includes(daysValue) ? daysValue : 1;
const supportedModels = new Set(["best_match", "icon", "gfs", "aifs"]);
// Keep in sync with DEFAULT_SCORING_MODEL; the standalone worker image copies scripts/.
const requestedModel = process.env.SNAPSHOT_MODEL?.trim() || "gfs";
if (!supportedModels.has(requestedModel)) throw new Error("Invalid SNAPSHOT_MODEL; expected best_match, icon, gfs or aifs");
const model = requestedModel;
const fireglowEnabled = process.env.SNAPSHOT_PREWARM_FIREGLOW === "1";
if (model === "icon" || model === "aifs") {
  console.warn(`[snapshot-worker] explicit ${model}: missing scoring fields remain fail-closed; check visibility capability`);
}
let stopped = false;
let timer = null;
let activeController = null;

async function requestSnapshot(endpoint, params, expectedObservingModel) {
  const controller = new AbortController();
  activeController = controller;
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  let retryAfterMs = 0;
  try {
    const response = await fetch(`${baseUrl}${endpoint}?${params.toString()}`, {
      signal: controller.signal, cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "star-weather-snapshot-worker/0.3.1" },
    });
    retryAfterMs = workerRetryAfterMs(response.headers.get("Retry-After"));
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(typeof payload?.error === "string" ? payload.error : `HTTP ${response.status}`);
    const healthy = snapshotHealth(
      payload,
      Date.now(),
      expectedObservingModel ?? model,
      params.get("date") ?? undefined,
    ).shouldPrewarm;
    console.log(`[snapshot-worker] ${endpoint} ${params.get("date")} ${model} ${params.get("time") ?? ""} ${healthy ? "fresh" : "stale"}`);
    return { healthy, retryAfterMs };
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    if (/daily.*limit|daily.*quota/i.test(text)) retryAfterMs = Math.max(retryAfterMs, 24 * 60 * 60_000);
    console.error(`[snapshot-worker] refresh failed: ${controller.signal.aborted ? "request timeout or shutdown" : text}`);
    // Any failure blocks topic prewarm, not just HTTP 429.
    return { healthy: false, retryAfterMs };
  } finally {
    clearTimeout(timeout);
    if (activeController === controller) activeController = null;
  }
}

async function refresh() {
  const context = observingContext();
  return requestSnapshot("/api/observing/snapshot", new URLSearchParams({
    date: context.date, days: String(days), model, time: context.time, refresh: "1",
  }), model);
}

/** Optional and serial. Stop at the first stale/error response, or on shutdown. */
async function prewarmFireglow() {
  const { calendarDate } = observingContext();
  let result = { healthy: true, retryAfterMs: 0 };
  for (let offset = 0; offset < 3 && !stopped; offset += 1) {
    const value = new Date(`${calendarDate}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    result = await requestSnapshot("/api/fireglow/snapshot", new URLSearchParams({
      date: value.toISOString().slice(0, 10), model,
    }), model);
    if (!result.healthy) break;
  }
  return result;
}

async function runLoop() {
  if (stopped) return;
  let result = await refresh();
  if (!stopped && result.healthy && fireglowEnabled) result = await prewarmFireglow();
  if (!stopped) {
    // Node timers overflow above 2^31-1. Keep an absolute deadline and recheck it.
    const nextAt = Date.now() + nextWorkerDelay(intervalMs, result.healthy, result.retryAfterMs);
    const schedule = () => {
      if (stopped) return;
      const remaining = nextAt - Date.now();
      if (remaining <= 0) { void runLoop(); return; }
      timer = setTimeout(schedule, Math.min(remaining, 2_147_483_647));
    };
    schedule();
  }
}
function stop() {
  stopped = true;
  if (timer) clearTimeout(timer);
  activeController?.abort();
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
await runLoop();
