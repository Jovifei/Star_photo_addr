import { describe, expect, it } from "vitest";
import { nearbyDirectorySites } from "@/lib/nearbyDirectorySites";

describe("nearbyDirectorySites", () => {
  const sites = [
    { id: "far", latitude: 35, longitude: 110, score: null },
    { id: "exact", latitude: 30, longitude: 120, score: 0 },
    { id: "near", latitude: 30.1, longitude: 120, score: 80 },
  ];

  it("sorts by geodesic distance without changing site data or inventing a score", () => {
    const result = nearbyDirectorySites({ latitude: 30, longitude: 120 }, sites, 2);
    expect(result.map(({ site }) => site.id)).toEqual(["exact", "near"]);
    expect(result[0].distanceKm).toBe(0);
    expect(result[0].site.score).toBe(0);
    expect(result[1].distanceKm).toBeGreaterThan(10);
    expect(result[1].distanceKm).toBeLessThan(12);
  });

  it("returns no nearby forecast when the directory has no sites", () => {
    expect(nearbyDirectorySites({ latitude: 30, longitude: 120 }, [])).toEqual([]);
  });
});
