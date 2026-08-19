import { describe, expect, it } from "vitest";
import {
  observationRefreshFamilyKey,
  observationSnapshotKey,
} from "@/lib/observingSnapshotStore";

describe("observation refresh families", () => {
  it("keeps exact snapshot keys distinct by range and focus time", () => {
    expect(
      observationSnapshotKey("2026-08-19", 1, "gfs", "2026-08-19T21:00"),
    ).not.toBe(
      observationSnapshotKey("2026-08-19", 7, "gfs", "2026-08-20T01:00"),
    );
  });

  it("uses one forced-refresh family for the same date and model", () => {
    const first = observationRefreshFamilyKey("2026-08-19", "gfs");
    const second = observationRefreshFamilyKey("2026-08-19", "gfs");
    expect(first).toBe(second);
    expect(first).not.toBe(
      observationRefreshFamilyKey("2026-08-19", "icon"),
    );
    expect(first).not.toBe(
      observationRefreshFamilyKey("2026-08-20", "gfs"),
    );
  });
});
