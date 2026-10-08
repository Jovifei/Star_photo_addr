import { dataAgeMs } from "./forecastIntegrity";
import type { ForecastModel } from "./types";
export interface SnapshotSourceTime {
  provider: "Open-Meteo";
  dataset: "surface" | "pressure";
  model: ForecastModel;
  sourceFetchedAt: string | null;
  providerRunAt: string | null;
  observedAt: string | null;
}
export interface SnapshotProvenance {
  version: 1;
  sourcesBySite: Record<string, SnapshotSourceTime[]>;
}
export function snapshotSourceTime(dataset: SnapshotSourceTime["dataset"], model: ForecastModel, fetchedAt?: string | null, runAt?: string | null): SnapshotSourceTime {
  return { provider: "Open-Meteo", dataset, model,
    sourceFetchedAt: fetchedAt && Number.isFinite(dataAgeMs(fetchedAt)) ? fetchedAt : null,
    providerRunAt: runAt && Number.isFinite(dataAgeMs(runAt)) ? runAt : null,
    observedAt: null };
}
/** Unknown acquisition time can never become fresh through snapshot regeneration. */
export function snapshotSourceAgeMs(provenance?: SnapshotProvenance, now = Date.now()): number {
  const sources = Object.values(provenance?.sourcesBySite ?? {}).flat();
  return sources.length ? Math.max(...sources.map(source => dataAgeMs(source.sourceFetchedAt, now))) : Infinity;
}
export function snapshotTransport<T extends { generatedAt?: string }>(snapshot: T, servedAt = new Date().toISOString()) {
  return { ...snapshot, transport: { servedAt } };
}
