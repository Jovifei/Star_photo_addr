import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ObservationSnapshot } from "@/lib/types";

const SNAPSHOT_DIRECTORY =
  process.env.OBSERVING_SNAPSHOT_DIR ??
  path.join(process.cwd(), "data", "snapshots");

function snapshotFile(key: string): string {
  const safeKey = key.replace(/[^a-z0-9_-]/gi, "_");
  return path.join(SNAPSHOT_DIRECTORY, `${safeKey}.json`);
}

export function isObservationSnapshot(
  value: unknown,
): value is ObservationSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ObservationSnapshot>;
  const validModels = ["best_match", "icon", "gfs", "aifs"];
  const validBands = [
    "priority",
    "recommended",
    "watch",
    "not-recommended",
    "unknown",
  ];
  const validConfidence = ["high", "medium", "low", "unknown"];
  const validScore = (score: unknown): boolean => {
    if (!score || typeof score !== "object") return false;
    const item = score as Record<string, unknown>;
    const nullableNumber = (field: unknown) =>
      field === null || typeof field === "number";
    return (
      nullableNumber(item.score) &&
      validBands.includes(String(item.band)) &&
      nullableNumber(item.cloud) &&
      nullableNumber(item.darkness) &&
      nullableNumber(item.weatherRisk) &&
      (item.bestWindow === null || typeof item.bestWindow === "string") &&
      Array.isArray(item.blockers) &&
      item.blockers.every((blocker) => typeof blocker === "string") &&
      validConfidence.includes(String(item.confidence)) &&
      typeof item.validHours === "number"
    );
  };
  return (
    typeof candidate.date === "string" &&
    [1, 3, 5, 7].includes(candidate.days as number) &&
    validModels.includes(String(candidate.model)) &&
    typeof candidate.generatedAt === "string" &&
    Number.isFinite(Date.parse(candidate.generatedAt)) &&
    typeof candidate.source === "string" &&
    typeof candidate.stale === "boolean" &&
    typeof candidate.sites === "object" &&
    candidate.sites !== null &&
    Object.values(candidate.sites).every(
      (scores) =>
        Array.isArray(scores) &&
        scores.length === candidate.days &&
        scores.every(validScore),
    ) &&
    (candidate.focusTime === undefined ||
      typeof candidate.focusTime === "string") &&
    (candidate.focusScores === undefined ||
      (typeof candidate.focusScores === "object" &&
        candidate.focusScores !== null &&
        Object.values(candidate.focusScores).every(validScore)))
  );
}

export function observationSnapshotKey(
  date: string,
  days: 1 | 3 | 5 | 7,
  model: string,
  focusTime?: string,
): string {
  return `observing-${date}-${days}-${model}${focusTime ? `-${focusTime}` : ""}`;
}

/**
 * Forced-refresh protection is intentionally broader than the exact snapshot
 * cache key. Varying days or focusTime must not bypass the cooldown and launch
 * repeated 242-location upstream jobs for the same date/model family.
 */
export function observationRefreshFamilyKey(
  date: string,
  model: string,
): string {
  return `observing-refresh-${date}-${model}`;
}

export async function readObservationSnapshot(
  key: string,
): Promise<ObservationSnapshot | null> {
  try {
    const raw = await readFile(snapshotFile(key), "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isObservationSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function snapshotAgeMs(snapshot: ObservationSnapshot): number {
  const generatedAt = Date.parse(snapshot.generatedAt);
  return Number.isFinite(generatedAt)
    ? Math.max(0, Date.now() - generatedAt)
    : Number.POSITIVE_INFINITY;
}

export function markSnapshotStale(
  snapshot: ObservationSnapshot,
  stale = true,
): ObservationSnapshot {
  return { ...snapshot, stale: snapshot.stale || stale };
}

export async function writeObservationSnapshot(
  key: string,
  snapshot: ObservationSnapshot,
): Promise<void> {
  await mkdir(SNAPSHOT_DIRECTORY, { recursive: true });
  const destination = snapshotFile(key);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(snapshot), "utf8");
  await rename(temporary, destination);
}
