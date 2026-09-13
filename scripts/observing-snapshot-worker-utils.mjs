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
