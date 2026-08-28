import { describe, expect, it } from "vitest";
import {
  DEFAULT_BORTLE_LEVELS,
  filterSitesByBortleLevels,
  toggleBortleLevel,
} from "@/lib/bortleFilters";

describe("Bortle level filters", () => {
  it("starts with B1-B3 and toggles individual cards", () => {
    expect(DEFAULT_BORTLE_LEVELS).toEqual([1, 2, 3]);
    expect(toggleBortleLevel(DEFAULT_BORTLE_LEVELS, 4)).toEqual([1, 2, 3, 4]);
    expect(toggleBortleLevel([1, 2, 3, 4], 2)).toEqual([1, 3, 4]);
  });

  it("never leaves the map with no selectable Bortle level", () => {
    expect(toggleBortleLevel([2], 2)).toEqual([2]);
  });

  it("filters point records by the selected levels rather than a hidden range", () => {
    const sites = [{ id: "b1", bortle: 1 }, { id: "b2", bortle: 2 }, { id: "b3", bortle: 3 }, { id: "b4", bortle: 4 }];
    expect(filterSitesByBortleLevels(sites, [1, 3]).map((site) => site.id)).toEqual(["b1", "b3"]);
  });
});
