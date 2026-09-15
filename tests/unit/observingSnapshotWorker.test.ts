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
  snapshotHealth: (payload: unknown, now?: number, expectedModel?: string) => { stale: boolean; logLabel: string; shouldPrewarm: boolean };
};

describe("observing snapshot worker stale contract", () => {
  it("classifies stale or identity-less snapshots as non-prewarmable", () => {
    expect(helperSource).toContain("payload?.stale !== false");
    expect(helperSource).toContain('payload?.integrityVersion !== "weather-integrity-v2"');
    expect(helperSource).toContain("sourceFetchedAt");
    expect(helperSource).toContain("shouldPrewarm: !stale");
    const now = Date.parse("2026-09-13T12:00:00Z");
    const fresh = { model: "gfs", stale: false, integrityVersion: "weather-integrity-v2", sourceFetchedAt: "2026-09-13T12:00:00Z" };
    expect(snapshotHealth(fresh, now, "gfs")).toEqual({
      stale: false,
      logLabel: "fresh",
      shouldPrewarm: true,
    });
    expect(snapshotHealth({ ...fresh, stale: true }, now, "gfs").shouldPrewarm).toBe(false);
    expect(snapshotHealth({ ...fresh, model: "icon" }, now, "gfs").logLabel).toBe("stale");
    expect(snapshotHealth({ ...fresh, integrityVersion: "weather-integrity-v1" }, now, "gfs").shouldPrewarm).toBe(false);
    expect(snapshotHealth({ ...fresh, sourceFetchedAt: undefined }, now, "gfs").shouldPrewarm).toBe(false);
  });

  it("does not log stale HTTP-200 snapshots as fresh or prewarm fireglow", () => {
    expect(workerSource).toContain("snapshotHealth(");
    expect(workerSource).toContain("expectedObservingModel ?? model");
    expect(workerSource).toContain('${healthy ? "fresh" : "stale"}');
    expect(workerSource).toContain("result.healthy && fireglowEnabled");
  });
});
