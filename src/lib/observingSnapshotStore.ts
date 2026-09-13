import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { ObservationSnapshot } from "@/lib/types";
import { dataAgeMs, MAX_FORECAST_AGE_MS, OBSERVATION_INTEGRITY_VERSION, sanitizeObservationSnapshot, type IntegritySnapshot } from "./forecastIntegrity";

const SNAPSHOT_DIRECTORY = process.env.OBSERVING_SNAPSHOT_DIR ?? path.join(process.cwd(), "data", "snapshots");
function snapshotFile(key: string): string {
  return path.join(SNAPSHOT_DIRECTORY, `${key.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}
export function isObservationSnapshot(value: unknown): value is ObservationSnapshot {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ObservationSnapshot>;
  const validModels = ["best_match", "icon", "gfs", "aifs"];
  const validBands = ["priority", "recommended", "watch", "not-recommended", "unknown"];
  const validConfidence = ["high", "medium", "low", "unknown"];
  const validScore = (score: unknown): boolean => {
    if (!score || typeof score !== "object") return false;
    const item = score as Record<string, unknown>;
    const nullableNumber = (field: unknown) => field === null || (typeof field === "number" && Number.isFinite(field));
    return nullableNumber(item.score) && validBands.includes(String(item.band)) &&
      nullableNumber(item.cloud) && nullableNumber(item.darkness) && nullableNumber(item.weatherRisk) &&
      (item.bestWindow === null || typeof item.bestWindow === "string") &&
      Array.isArray(item.blockers) && item.blockers.every((blocker) => typeof blocker === "string") &&
      validConfidence.includes(String(item.confidence)) && typeof item.validHours === "number" && Number.isFinite(item.validHours);
  };
  return typeof candidate.date === "string" && [1, 3, 5, 7].includes(candidate.days as number) &&
    validModels.includes(String(candidate.model)) && typeof candidate.generatedAt === "string" &&
    Number.isFinite(Date.parse(candidate.generatedAt)) && typeof candidate.source === "string" &&
    typeof candidate.stale === "boolean" && typeof candidate.sites === "object" && candidate.sites !== null &&
    Object.values(candidate.sites).every((scores) => Array.isArray(scores) && scores.length === candidate.days && scores.every(validScore)) &&
    (candidate.focusTime === undefined || typeof candidate.focusTime === "string") &&
    (candidate.focusScores === undefined || (typeof candidate.focusScores === "object" && candidate.focusScores !== null && Object.values(candidate.focusScores).every(validScore)));
}
export function observationSnapshotKey(date: string, days: 1 | 3 | 5 | 7, model: string, focusTime?: string): string {
  return `observing-${date}-${days}-${model}${focusTime ? `-${focusTime}` : ""}`;
}
/** days/focusTime must not bypass the same date/model refresh cooldown. */
export function observationRefreshFamilyKey(date: string, model: string): string {
  return `observing-refresh-${date}-${model}`;
}
export async function readObservationSnapshot(key: string): Promise<ObservationSnapshot | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(snapshotFile(key), "utf8"));
    if (!isObservationSnapshot(parsed)) return null;
    // Old high-score snapshots must never bypass the new scorer, even if their timestamp is recent.
    if ((parsed as IntegritySnapshot).integrityVersion !== OBSERVATION_INTEGRITY_VERSION) return null;
    if (snapshotAgeMs(parsed) > MAX_FORECAST_AGE_MS) return null;
    return sanitizeObservationSnapshot(parsed);
  } catch { return null; }
}
export function snapshotAgeMs(snapshot: ObservationSnapshot): number {
  return Math.max(dataAgeMs(snapshot.generatedAt), dataAgeMs((snapshot as IntegritySnapshot).sourceFetchedAt));
}
export function markSnapshotStale(snapshot: ObservationSnapshot, stale = true): ObservationSnapshot {
  return sanitizeObservationSnapshot({ ...snapshot, stale: snapshot.stale || stale });
}
export async function writeObservationSnapshot(key: string, snapshot: ObservationSnapshot): Promise<void> {
  await mkdir(SNAPSHOT_DIRECTORY, { recursive: true });
  const destination = snapshotFile(key);
  const temporary = `${destination}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(sanitizeObservationSnapshot(snapshot)), "utf8");
  await rename(temporary, destination);
}
