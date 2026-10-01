export function snapshotHealth(payload) {
  const hasSourceFetchedAt =
    typeof payload?.sourceFetchedAt === "string" &&
    payload.sourceFetchedAt.length > 0;
  const stale =
    payload?.stale === true ||
    payload?.integrityVersion !== "weather-integrity-v2" ||
    !hasSourceFetchedAt;
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
