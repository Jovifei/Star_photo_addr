export function snapshotHealth(payload, expectedModel, expectedDate) {
  const hasSourceFetchedAt =
    typeof payload?.sourceFetchedAt === "string" &&
    Number.isFinite(Date.parse(payload.sourceFetchedAt)) &&
    /(?:Z|[+-]\d{2}:\d{2})$/.test(payload.sourceFetchedAt);
  const stale =
    payload?.stale !== false ||
    payload?.integrityVersion !== "weather-integrity-v2" ||
    !hasSourceFetchedAt ||
    (expectedModel !== undefined && payload?.model !== expectedModel) ||
    (expectedDate !== undefined && payload?.date !== expectedDate);
  return {
    stale,
    logLabel: stale ? "stale" : "fresh",
    shouldPrewarm: !stale,
  };
}

export function retryAfterDelay(value, now = Date.now()) {
  if (!value?.trim()) return 0;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, Math.min(24 * 60 * 60_000, delay)) : 0;
}


/** Shanghai early-morning hours belong to the previous observing night. */
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
