import { describe, expect, it } from "vitest";
import { CLOUD_SEA_EMPTY_WINDOW } from "@/lib/cloudsea";
import { selectCloudSeaWindow } from "@/lib/cloudseaWindowSelection";

const partial = {
  ...CLOUD_SEA_EMPTY_WINDOW, peakTime: "05:00", peakScore: 98,
  coverage: { expectedHours: 4, surfaceValidHours: 1, scoreableHours: 1, pressureHours: 1 },
};

describe("cloud-sea window evidence selection", () => {
  it("retains the raw partial window without inventing a mean", () => {
    const selected = selectCloudSeaWindow([{ date: "2026-10-22", window: partial }]);
    expect(selected?.window).toBe(partial);
    expect(selected?.window.score).toBeNull();
    expect(selected?.window.coverage?.expectedHours).toBe(4);
  });

  it("keeps an unavailable window's best-hour evidence bound to its actual day", () => {
    const entries = [
      { date: "2026-10-22", window: CLOUD_SEA_EMPTY_WINDOW },
      { date: "2026-10-23", window: partial },
      { date: "2026-10-24", window: { ...partial, peakScore: 60 } },
    ];
    expect(selectCloudSeaWindow(entries)).toBe(entries[1]);
  });

  it("never ranks a single high hour above a publishable window mean", () => {
    const full = { date: "2026-10-24", window: { ...partial, score: 31, conditionLabel: "31/100" } };
    expect(selectCloudSeaWindow([{ date: "2026-10-23", window: partial }, full])).toBe(full);
  });

  it("preserves surface facts with no peak and returns null for no data", () => {
    const entries = [{ window: CLOUD_SEA_EMPTY_WINDOW }, { window: { ...CLOUD_SEA_EMPTY_WINDOW, humidity: 90 } }];
    expect(selectCloudSeaWindow(entries)).toBe(entries[1]);
    expect(selectCloudSeaWindow([])).toBeNull();
  });
});
