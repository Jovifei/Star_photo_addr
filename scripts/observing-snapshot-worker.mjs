const baseUrl = (process.env.SNAPSHOT_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const intervalMs = Number(process.env.SNAPSHOT_INTERVAL_MS || 30 * 60 * 1000);
const days = [1, 3, 5, 7].includes(Number(process.env.SNAPSHOT_DAYS))
  ? Number(process.env.SNAPSHOT_DAYS)
  : 7;
const model = process.env.SNAPSHOT_MODEL || "icon";

function shanghaiDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function refresh() {
  const date = shanghaiDate();
  const url = `${baseUrl}/api/observing/snapshot?date=${date}&days=${days}&model=${model}&refresh=1`;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    console.log(`[snapshot-worker] ${date} ${model} ${days}d ${payload?.stale ? "stale" : "fresh"}`);
  } catch (error) {
    console.error(`[snapshot-worker] refresh failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

await refresh();
setInterval(refresh, Math.max(60_000, intervalMs));
