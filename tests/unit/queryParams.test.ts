import { describe, expect, it } from "vitest";
import {
  parseCoordinateLists,
  parseCoordinatePair,
} from "@/lib/server/queryParams";

describe("server query coordinate parsing", () => {
  it("accepts zero and the short aliases", () => {
    expect(parseCoordinatePair(new URLSearchParams("lat=0&lng=0"))).toEqual({
      latitude: 0,
      longitude: 0,
    });
  });

  it("rejects blank values instead of coercing them to zero", () => {
    expect(parseCoordinatePair(new URLSearchParams("lat=&lng="))).toBeNull();
    expect(
      parseCoordinateLists(
        new URLSearchParams("latitude=30.2,&longitude=120.1,121.2"),
        64,
      ),
    ).toBeNull();
  });

  it("requires aligned in-range coordinate lists", () => {
    expect(
      parseCoordinateLists(
        new URLSearchParams(
          "latitude=30.2,31.3&longitude=120.1,121.2",
        ),
        64,
      ),
    ).toEqual({
      latitudes: [30.2, 31.3],
      longitudes: [120.1, 121.2],
    });
    expect(
      parseCoordinateLists(
        new URLSearchParams("latitude=30.2,31.3&longitude=120.1"),
        64,
      ),
    ).toBeNull();
    expect(
      parseCoordinateLists(
        new URLSearchParams("latitude=91&longitude=120.1"),
        64,
      ),
    ).toBeNull();
  });
});
