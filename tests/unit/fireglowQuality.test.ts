import { describe, expect, it } from "vitest";
import type { FireGlowSnapshot } from "@/lib/fireglow";
import { FIRE_GLOW_FRESH_MS, fireGlowBatchDegraded, fireGlowSiteQuality } from "@/lib/fireglowQuality";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const DATE = "2026-10-28";
const stamp = (offset = 0) => new Date(NOW + offset).toISOString();
const source = (time: string | null = stamp(), model = "icon") => ({
  provider: "Open-Meteo", dataset: "surface", model, sourceFetchedAt: time, providerRunAt: null, observedAt: null,
});
function snapshot(): FireGlowSnapshot {
  return {
    date: DATE, model: "icon", generatedAt: stamp(), source: "test", stale: false,
    sites: {
      fresh: { morning: { score: 70 }, evening: { score: 80 } },
      other: { morning: { score: 50 }, evening: { score: 60 } },
    },
    provenance: { version: 1, sourcesBySite: { fresh: [source()], other: [source()] } },
    sourceQuality: { version: 1, bySite: { fresh: { status: "available", model: "icon" }, other: { status: "available", model: "icon" } }, staleScope: "none" },
  } as unknown as FireGlowSnapshot;
}
const assess = (s: FireGlowSnapshot, site = "fresh", phase: "morning" | "evening" = "evening", now = NOW, dateError?: string) =>
  fireGlowSiteQuality(s, DATE, site, phase, "icon", dateError, now);

describe("fireglow site quality", () => {
  it("distinguishes a fresh point from an explicitly stale point in one stale batch", () => {
    const s = snapshot();
    s.stale = true;
    s.sourceQuality!.staleScope = "site";
    s.sourceQuality!.bySite.other.status = "stale";
    expect(fireGlowBatchDegraded(s, NOW)).toBe(true);
    expect(assess(s).state).toBe("fresh");
    expect(assess(s, "other").state).toBe("stale");
  });

  it("handles all fresh, all old and old source age independently of generatedAt", () => {
    const s = snapshot();
    expect(assess(s).state).toBe("fresh");
    for (const items of Object.values(s.provenance!.sourcesBySite)) items[0].sourceFetchedAt = stamp(-FIRE_GLOW_FRESH_MS - 1);
    expect(fireGlowBatchDegraded(s, NOW)).toBe(true);
    expect(assess(s).state).toBe("expired");
    expect(assess(s, "other").state).toBe("expired");
  });

  it("can explain site-scoped stale solely by a different old source", () => {
    const s = snapshot();
    s.stale = true; s.sourceQuality!.staleScope = "site";
    s.provenance!.sourcesBySite.other[0].sourceFetchedAt = stamp(-FIRE_GLOW_FRESH_MS - 1);
    expect(assess(s).state).toBe("fresh");
    expect(assess(s, "other").state).toBe("expired");
  });

  it("keeps unexplained or snapshot-wide stale conservative", () => {
    const s = snapshot();
    s.stale = true;
    s.sourceQuality!.staleScope = "site";
    expect(assess(s).state).toBe("unknown");
    s.sourceQuality!.bySite.other.status = "stale";
    s.sourceQuality!.staleScope = "snapshot";
    expect(assess(s).state).toBe("unknown");
  });

  it.each([null, "bad", "2026-10-28T12:00:00", stamp(5 * 60_000 + 1)])("rejects missing, invalid or too-future source time %s", (time) => {
    const s = snapshot();
    s.provenance!.sourcesBySite.fresh[0].sourceFetchedAt = time;
    expect(assess(s).state).toBe("unknown");
  });

  it("uses the shared five-minute future tolerance and the exact 30-minute boundary", () => {
    const s = snapshot();
    s.provenance!.sourcesBySite.fresh[0].sourceFetchedAt = stamp(5 * 60_000);
    expect(assess(s).state).toBe("fresh");
    s.provenance!.sourcesBySite.fresh[0].sourceFetchedAt = stamp(-FIRE_GLOW_FRESH_MS);
    expect(assess(s).state).toBe("fresh");
    expect(assess(s, "fresh", "evening", NOW + 1).state).toBe("expired");
  });

  it("rejects impossible calendar dates that Date.parse would normalize", () => {
    const s = snapshot();
    const normalizedDate = Date.parse("2026-03-02T12:00:00Z");
    s.provenance!.sourcesBySite.fresh[0].sourceFetchedAt = "2026-02-30T12:00:00Z";
    s.provenance!.sourcesBySite.other[0].sourceFetchedAt = "2026-03-02T12:00:00Z";
    expect(fireGlowBatchDegraded(s, normalizedDate)).toBe(true);
    expect(assess(s, "fresh", "evening", normalizedDate).state).toBe("unknown");
    expect(assess(s, "other", "evening", normalizedDate).state).toBe("fresh");
  });

  it("does not trust missing provenance, a legacy contract, or mismatched models", () => {
    const s = snapshot();
    s.provenance!.sourcesBySite.fresh = [];
    expect(assess(s).state).toBe("unknown");
    s.provenance!.sourcesBySite.fresh = [source() as never];
    delete s.sourceQuality;
    expect(assess(s).state).toBe("unknown");
    const t = snapshot();
    t.sourceQuality!.bySite.fresh.model = "gfs";
    expect(assess(t).state).toBe("unknown");
    t.sourceQuality!.bySite.fresh.model = "icon";
    t.provenance!.sourcesBySite.fresh[0].model = "gfs";
    expect(assess(t).state).toBe("unknown");
    t.provenance!.sourcesBySite.fresh[0].model = "icon";
    t.model = "gfs";
    expect(assess(t).state).toBe("unknown");
  });

  it("treats malformed source entries as unknown instead of crashing or explaining stale", () => {
    const s = snapshot();
    s.stale = true;
    s.sourceQuality!.staleScope = "site";
    s.sourceQuality!.bySite.other.status = "stale";
    s.provenance!.sourcesBySite.other = [null as never];
    expect(fireGlowBatchDegraded(s, NOW)).toBe(true);
    expect(assess(s).state).toBe("unknown");
    expect(assess(s, "other").state).toBe("stale");
  });

  it("checks the selected phase, date, location and refresh independently", () => {
    const s = snapshot();
    s.sites.fresh.morning.score = null;
    expect(assess(s, "fresh", "morning").state).toBe("insufficient");
    expect(assess(s, "fresh", "evening").state).toBe("fresh");
    expect(assess(s, "missing").state).toBe("insufficient");
    expect(fireGlowSiteQuality(s, "2026-10-29", "fresh", "evening", "icon", undefined, NOW).state).toBe("unknown");
    expect(assess(s, "fresh", "evening", NOW, "HTTP 503").state).toBe("refresh-failed");
    s.refreshError = "cooldown";
    expect(assess(s).state).toBe("refresh-failed");
  });
});
