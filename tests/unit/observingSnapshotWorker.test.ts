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
const { snapshotHealth } = (await import("../../scripts/observing-snapshot-worker-utils.mjs")) as {
  snapshotHealth: (payload: unknown) => { stale: boolean; logLabel: string; shouldPrewarm: boolean };
};

describe("observing snapshot worker stale contract", () => {
  it("classifies stale or identity-less snapshots as non-prewarmable", () => {
    expect(helperSource).toContain('payload?.stale === true');
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
