import { describe, expect, it } from "vitest";
import { interpolateScoreGrid } from "@/lib/fireglowOverlay";

const BOUNDS: [[number, number], [number, number]] = [
  [25, 110],
  [35, 125],
];

function gridValue(grid: Float32Array, width: number, lat: number, lng: number): number {
  const [south, west] = BOUNDS[0];
  const [north, east] = BOUNDS[1];
  const height = grid.length / width;
  const row = Math.min(height - 1, Math.max(0, Math.round(((lat - south) / (north - south)) * (height - 1))));
  const column = Math.min(width - 1, Math.max(0, Math.round(((lng - west) / (east - west)) * (width - 1))));
  return grid[row * width + column];
}

describe("interpolateScoreGrid", () => {
  const width = 15;
  const height = 10;

  it("takes the exact site value when the cell sits on a site", () => {
    const grid = interpolateScoreGrid(
      [{ latitude: 30, longitude: 117.5, score: 88 }],
      width,
      height,
      BOUNDS,
    );
    expect(gridValue(grid, width, 30, 117.5)).toBeCloseTo(88, 0);
  });

  it("interpolates between two sites", () => {
    const grid = interpolateScoreGrid(
      [
        { latitude: 30, longitude: 110, score: 90 },
        { latitude: 30, longitude: 125, score: 10 },
      ],
      width,
      height,
      BOUNDS,
    );
    const west = gridValue(grid, width, 30, 112);
    const east = gridValue(grid, width, 30, 123);
    expect(west).toBeGreaterThan(50);
    expect(east).toBeLessThan(50);
  });

  it("leaves cells beyond the influence radius transparent (NaN)", () => {
    const grid = interpolateScoreGrid(
      [{ latitude: 30, longitude: 117.5, score: 80 }],
      width,
      height,
      BOUNDS,
    );
    // 5.5° ≈ 550 km north — beyond the ~340 km radius.
    expect(Number.isFinite(gridValue(grid, width, 35.4, 117.5))).toBe(false);
  });

  it("returns an all-NaN grid without valid points", () => {
    const grid = interpolateScoreGrid([], width, height, BOUNDS);
    expect(Array.from(grid).every((value) => Number.isNaN(value))).toBe(true);
  });
});
