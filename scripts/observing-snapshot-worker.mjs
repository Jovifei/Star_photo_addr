const baseUrl = (
  process.env.SNAPSHOT_BASE_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "");

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
}

const intervalMs = boundedNumber(
  process.env.SNAPSHOT_INTERVAL_MS,
  3 * 60 * 60 * 1000, // 3 hours (weather models only update every 6 hours)
  60_000,
  24 * 60 * 60 * 1000,
);
const requestTimeoutMs = boundedNumber(
  process.env.SNAPSHOT_WORKER_REQUEST_TIMEOUT_MS,
  150_000,
  10_000,
  5 * 60_000,
);
const daysValue = Number(process.env.SNAPSHOT_DAYS);
const days = [1, 3, 5, 7].includes(daysValue) ? daysValue : 7;
const supportedModels = new Set(["best_match", "icon", "gfs", "aifs"]);
const requestedModel = process.env.SNAPSHOT_MODEL || "icon";
const model = supportedModels.has(requestedModel) ? requestedModel : "icon";

let stopped = false;
let timer = null;
let activeController = null;
let lastErrorWasRateLimit = false;

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

async function refresh() {
  const date = shanghaiDate();
  const params = new URLSearchParams({
    date,
    days: String(days),
    model,
    refresh: "1",
  });
  activeController = new AbortController();
  const timeout = setTimeout(
    () => activeController?.abort(),
    requestTimeoutMs,
  );
  try {
    const response = await fetch(
      `${baseUrl}/api/observing/snapshot?${params.toString()}`,
      {
        signal: activeController.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": "star-weather-snapshot-worker/0.3.1",
        },
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }
    lastErrorWasRateLimit = false;
  } catch (error) {
    const errText = error instanceof Error ? error.message : String(error);
    lastErrorWasRateLimit = /429|limit exceeded/i.test(errText);
    const timedOut =
      activeController?.signal.aborted ||
      (error instanceof Error && /aborted|timeout/i.test(error.message));
    console.error(
      `[snapshot-worker] refresh failed: ${
        timedOut
          ? "request timeout"
          : errText
      }`,
    );
  } finally {
    clearTimeout(timeout);
    activeController = null;
  }
}

// Pre-warm today/+1/+2 fireglow snapshots so evening page loads hit memory
// instead of a cold 242-point upstream fan-out. Serial and non-fatal: a
// failed date must never block the observing snapshot or the other dates.
async function prewarmFireglow() {
  const date = shanghaiDate();
  for (let offset = 0; offset < 3; offset += 1) {
    const value = new Date(`${date}T12:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    const target = value.toISOString().slice(0, 10);
    const params = new URLSearchParams({
      date: target,
      model,
    });
    activeController = new AbortController();
    const timeout = setTimeout(
      () => activeController?.abort(),
      requestTimeoutMs,
    );
    try {
      const response = await fetch(
        `${baseUrl}/api/fireglow/snapshot?${params.toString()}`,
        {
          signal: activeController.signal,
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "User-Agent": "star-weather-snapshot-worker/0.3.1",
          },
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      console.log(
        `[snapshot-worker] fireglow ${target} ${model} ${payload?.stale ? "stale" : "fresh"}`,
      );
    } catch (error) {
      const timedOut =
        activeController?.signal.aborted ||
        (error instanceof Error && /aborted|timeout/i.test(error.message));
      console.error(
        `[snapshot-worker] fireglow ${target} failed: ${
          timedOut
            ? "request timeout"
            : error instanceof Error
              ? error.message
              : String(error)
        }`,
      );
    } finally {
      clearTimeout(timeout);
      activeController = null;
    }
  }
}

async function runLoop() {
  if (stopped) return;
  await refresh();
  if (!stopped && !lastErrorWasRateLimit) {
    await prewarmFireglow();
  }
  if (!stopped) {
    const nextWait = lastErrorWasRateLimit
      ? Math.max(intervalMs, 2 * 60 * 60 * 1000)
      : intervalMs;
    timer = setTimeout(runLoop, nextWait);
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
