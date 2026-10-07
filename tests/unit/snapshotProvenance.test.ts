import { expect, it, vi } from "vitest";
import { snapshotSourceAgeMs, snapshotSourceTime, snapshotTransport } from "@/lib/snapshotProvenance";
import { buildFireGlowSnapshot } from "@/lib/fireglow";
it("retains source acquisition time across later snapshot generation and cache transport", () => {
  vi.useFakeTimers(); vi.setSystemTime("2026-10-07T12:00:00Z");
  try {
    const record = { status: "stale" as const, hourly: null, fetchedAt: "2026-10-07T07:00:00Z" };
    const snapshot = buildFireGlowSnapshot("2026-10-07", "icon", { "2026-10-07": { point: record } });
    expect(snapshot.provenance?.sourcesBySite.point[0].sourceFetchedAt).toBe(record.fetchedAt);
    expect(snapshot.provenance?.sourcesBySite.point[0].providerRunAt).toBeNull();
    expect(snapshot.provenance?.sourcesBySite.point[0].observedAt).toBeNull();
    const transported = snapshotTransport(snapshot, "2026-10-07T13:00:00Z");
    expect(transported.generatedAt).toBe(snapshot.generatedAt);
    expect(transported.provenance).toEqual(snapshot.provenance);
    expect(snapshotSourceAgeMs(snapshot.provenance)).toBe(5 * 3600000);
  } finally { vi.useRealTimers(); }
});
it("keeps unknown supplier clocks unknown and cannot mark them fresh", () => {
  expect(snapshotSourceTime("pressure", "gfs").sourceFetchedAt).toBeNull();
  expect(snapshotSourceAgeMs()).toBe(Infinity);
});
it("an empty regenerated snapshot has no supplier clock and stays stale", () => {
  const snapshot = buildFireGlowSnapshot("2026-10-07", "icon", {});
  expect(snapshotSourceAgeMs(snapshot.provenance)).toBe(Infinity);
  expect(snapshot.stale).toBe(true);
});
