import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workerSource = readFileSync(
  new URL("../../scripts/observing-snapshot-worker.mjs", import.meta.url),
  "utf8",
);
const helperSource = readFileSync(
  new URL("../../scripts/observing-snapshot-worker-utils.mjs", import.meta.url),
  "utf8",
);
const { snapshotHealth, retryAfterDelay, observingContext } = (await import("../../scripts/observing-snapshot-worker-utils.mjs")) as {
  observingContext: (now: Date) => { date: string; calendarDate: string; time: string };
  retryAfterDelay: (value: string | null, now?: number) => number;
  snapshotHealth: (payload: unknown, model?: string, date?: string) => { stale: boolean; logLabel: string; shouldPrewarm: boolean };
};

describe("observing snapshot worker stale contract", () => {
  it("respects provider seconds and HTTP dates beyond two hours", () => {
    const now = Date.parse("2026-09-30T12:00:00Z");
    expect(retryAfterDelay("28800", now)).toBe(8 * 3600_000);
    expect(retryAfterDelay("Wed, 30 Sep 2026 20:00:00 GMT", now)).toBe(8 * 3600_000);
    expect(retryAfterDelay(null, now)).toBe(0);
    expect(retryAfterDelay("invalid", now)).toBe(0);
    expect(retryAfterDelay("-3", now)).toBe(0);
    expect(retryAfterDelay("999999", now)).toBe(24 * 3600_000);
  });
  it("classifies stale or identity-less snapshots as non-prewarmable", () => {
    expect(helperSource).toContain('payload?.stale !== false');
    expect(helperSource).toContain('payload?.integrityVersion !== "weather-integrity-v2"');
    expect(helperSource).toContain("!hasSourceFetchedAt");
    expect(helperSource).toContain("shouldPrewarm: !stale");
    expect(snapshotHealth({ stale: false, integrityVersion: "weather-integrity-v2", sourceFetchedAt: "2026-09-13T12:00:00Z" })).toEqual({
      stale: false,
      logLabel: "fresh",
      shouldPrewarm: true,
    });
    expect(snapshotHealth({ stale: true, integrityVersion: "weather-integrity-v2", sourceFetchedAt: "2026-09-13T12:00:00Z" }).shouldPrewarm).toBe(false);
    expect(snapshotHealth({ stale: false, integrityVersion: "weather-integrity-v2" }).logLabel).toBe("stale");
  });

  it("does not log stale HTTP-200 snapshots as fresh or prewarm fireglow", () => {
    expect(workerSource).toContain("lastRefreshWasStale = health.stale");
    expect(workerSource).toContain("${health.logLabel}");
    expect(workerSource).toContain("!lastErrorWasRateLimit && !lastRefreshWasStale");
    expect(workerSource).toContain("lastErrorWasRateLimit || lastRefreshWasStale");
  });
});


describe("worker observing identity", () => {
  it("keeps midnight through 05:00 on the previous night", () => {
    expect(observingContext(new Date("2026-10-01T16:00:00Z"))).toEqual({ date: "2026-10-01", calendarDate: "2026-10-02", time: "2026-10-02T00:00" });
    expect(observingContext(new Date("2026-10-01T21:00:00Z")).date).toBe("2026-10-01");
    expect(observingContext(new Date("2026-10-01T22:00:00Z")).date).toBe("2026-10-02");
  });
  it("withholds prewarm for malformed source time or mismatched model/date", () => {
    const good = { stale: false, integrityVersion: "weather-integrity-v2", sourceFetchedAt: "2026-10-01T12:00:00Z", model: "icon", date: "2026-10-01" };
    expect(snapshotHealth(good, "icon", "2026-10-01").shouldPrewarm).toBe(true);
    expect(snapshotHealth(good, "gfs", "2026-10-01").shouldPrewarm).toBe(false);
    expect(snapshotHealth(good, "icon", "2026-10-02").shouldPrewarm).toBe(false);
    expect(snapshotHealth({ ...good, sourceFetchedAt: "not-a-date" }).shouldPrewarm).toBe(false);
    expect(snapshotHealth({ ...good, sourceFetchedAt: "2026-10-01T12:00:00" }).shouldPrewarm).toBe(false);
  });
});
