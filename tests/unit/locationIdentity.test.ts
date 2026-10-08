import { describe, expect, it } from "vitest";
import {
  coordinateIdentityKey,
  dedupeLocationIdentities,
  sameLocationIdentity,
  stableSampleLocationId,
} from "@/lib/locationIdentity";

describe("location identity", () => {
  it("treats different IDs at the same coordinates as one location", () => {
    const first = { id: "curated-a", latitude: 30.123456, longitude: 120.654321 };
    const second = { id: "custom-b", latitude: 30.123456, longitude: 120.654321 };
    expect(sameLocationIdentity(first, second)).toBe(true);
    expect(dedupeLocationIdentities([first, second])).toEqual([first]);
  });

  it("keeps nearby but distinct viewpoints", () => {
    const first = { id: "a", latitude: 30.12345, longitude: 120.65432 };
    const second = { id: "b", latitude: 30.12347, longitude: 120.65432 };
    expect(sameLocationIdentity(first, second)).toBe(false);
    expect(dedupeLocationIdentities([first, second])).toHaveLength(2);
  });

  it("rejects invalid coordinates from persisted candidate input", () => {
    expect(coordinateIdentityKey({ latitude: 91, longitude: 120 })).toBeNull();
    expect(
      dedupeLocationIdentities([
        { id: "bad", latitude: 91, longitude: 120 },
        { id: "ok", latitude: 30, longitude: 120 },
      ]),
    ).toEqual([{ id: "ok", latitude: 30, longitude: 120 }]);
  });

  it("builds a stable sample ID for repeated clicks", () => {
    expect(stableSampleLocationId(30.123456, 120.654321)).toBe(
      "custom-30.12346-120.65432",
    );
  });

  it("treats sub-metre floating-point noise as the same station", () => {
    const first = { id: "a", latitude: 30.4694, longitude: 119.5978 };
    const second = { id: "b", latitude: 30.469404, longitude: 119.597801 };
    expect(sameLocationIdentity(first, second)).toBe(true);
    expect(dedupeLocationIdentities([first, second])).toEqual([first]);
  });

  it("keeps the first record when duplicate aliases carry different scores", () => {
    const first = {
      id: "official",
      latitude: 30.4694,
      longitude: 119.5978,
      score: 45,
    };
    const second = {
      id: "alias",
      latitude: 30.4694,
      longitude: 119.5978,
      score: 38,
    };
    expect(dedupeLocationIdentities([first, second])).toEqual([first]);
  });
});

import { locationIdentity, resolveLocationTransfer } from "@/lib/locationIdentity";

describe("coordinate-bound catalogue transfers", () => {
  const origin = locationIdentity({ id: "finder-147-location", name: "雅安牛背山", latitude: 29.782, longitude: 102.582 }, "observing");
  const destination = { id: "cs-niubeishan", name: "雅安牛背山", latitude: 29.742, longitude: 102.325 };
  it("keeps the two Niubeishan coordinates separate", () => {
    const result = resolveLocationTransfer(origin, [destination], "cloudsea");
    expect(result.status).toBe("conflict");
    expect(result.site).toBeNull();
    expect(result.distanceKm).toBeGreaterThan(24);
    expect(result.distanceKm).toBeLessThan(26);
  });
  it("rejects contradictory coordinates even with matching canonical and source IDs", () => {
    const forged = { ...origin, sourceScope: "cloudsea" as const, sourceId: destination.id, canonicalId: "cloudsea:cs-niubeishan" };
    expect(resolveLocationTransfer(forged, [destination], "cloudsea").status).toBe("conflict");
  });
  it("does not announce unrelated catalogue differences", () => {
    expect(resolveLocationTransfer({ ...origin, name: "任意地点" }, [destination], "cloudsea").status).toBe("coordinate");
  });
  it("matches a catalogue ID only when its coordinates also agree", () => {
    const exact = locationIdentity(destination, "cloudsea");
    expect(resolveLocationTransfer(exact, [destination], "cloudsea").site?.id).toBe(destination.id);
  });
  it("does not merge distinct same-name viewpoints", () => {
    expect(resolveLocationTransfer(origin, [{ ...destination, latitude: origin.latitude, longitude: origin.longitude }, destination], "cloudsea").status).toBe("conflict");
  });
});

it("same IDs cannot bypass conflicting coordinates in shared store identity", () => {
  const a = { id: "same", latitude: 29.782, longitude: 102.582 };
  const b = { id: "same", latitude: 29.742, longitude: 102.325 };
  expect(sameLocationIdentity(a, b)).toBe(false);
  expect(dedupeLocationIdentities([a,b])).toHaveLength(2);
});
