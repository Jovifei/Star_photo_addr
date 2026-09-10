/** Keep only locations with a numeric score at or above a 0–100 threshold. */
export function filterByScoreThreshold<T>(
  items: readonly T[],
  threshold: number,
  getScore: (item: T) => number | null | undefined = (item) =>
    (item as { score?: number | null }).score,
): T[] {
  const safeThreshold = Math.min(100, Math.max(0, Math.round(threshold)));
  return items.filter((item) => {
    const score = getScore(item);
    return typeof score === "number" && Number.isFinite(score) && score >= safeThreshold;
  });
}
