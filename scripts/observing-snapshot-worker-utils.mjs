const MAX_SOURCE_AGE_MS = 6 * 60 * 60_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export function snapshotHealth(payload, now = Date.now(), expectedModel, expectedDate) {
  const timestamp = payload?.sourceFetchedAt;
  const sourceTime = typeof timestamp === "string" && /(Z|[+-]\d{2}:\d{2})$/i.test(timestamp)
    ? Date.parse(timestamp) : NaN;
  const validSourceTime = Number.isFinite(sourceTime) &&
    sourceTime <= now + FUTURE_TOLERANCE_MS && now - sourceTime <= MAX_SOURCE_AGE_MS;
  const stale = payload?.stale !== false ||
    payload?.integrityVersion !== "weather-integrity-v2" || !validSourceTime ||
    (expectedModel !== undefined && payload?.model !== expectedModel) ||
    (expectedDate !== undefined && payload?.date !== expectedDate);
  return { stale, logLabel: stale ? "stale" : "fresh", shouldPrewarm: !stale };
}

/** Match the UI's 20:00–05:00 observing-night key, regardless of host timezone. */
export function observingContext(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const calendarDate = `${values.year}-${values.month}-${values.day}`;
  let date = calendarDate;
  if (Number(values.hour) <= 5) {
    const previous = new Date(`${calendarDate}T12:00:00Z`);
    previous.setUTCDate(previous.getUTCDate() - 1);
    date = previous.toISOString().slice(0, 10);
  }
  return { date, calendarDate, time: `${calendarDate}T${values.hour}:00` };
}

export function workerRetryAfterMs(value, now = Date.now()) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return 0;
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) ? Math.max(0, seconds * 1_000) : 0;
  }
  const instant = Date.parse(text);
  return Number.isFinite(instant) ? Math.max(0, instant - now) : 0;
}

export function nextWorkerDelay(intervalMs, healthy, retryAfterMs = 0) {
  return Math.max(intervalMs, healthy ? 0 : 2 * 60 * 60_000, retryAfterMs);
}
