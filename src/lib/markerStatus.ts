export const UNKNOWN_MARKER_LEVEL = "unknown" as const;

export function markerLevelFor<T extends string>(
  score: number | null | undefined,
  level: T | null | undefined,
): T | typeof UNKNOWN_MARKER_LEVEL {
  return score == null || level == null ? UNKNOWN_MARKER_LEVEL : level;
}
