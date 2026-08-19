import { describe, expect, it } from "vitest";
import { TimedCache } from "@/lib/serverCache";

describe("TimedCache", () => {
  it("returns fresh and stale ages without mutating the value", () => {
    const cache = new TimedCache<{ value: number }>();
    cache.write("a", { value: 1 }, 1_000);
    expect(cache.readFresh("a", 500, 1_400)?.value).toEqual({ value: 1 });
    expect(cache.readFresh("a", 500, 1_501)).toBeNull();
    expect(cache.read("a", 2_000)?.ageMs).toBe(1_000);
  });

  it("evicts the oldest entry when the bound is exceeded", () => {
    const cache = new TimedCache<number>(2);
    cache.write("a", 1, 1);
    cache.write("b", 2, 2);
    cache.write("c", 3, 3);
    expect(cache.read("a", 4)).toBeNull();
    expect(cache.read("b", 4)?.value).toBe(2);
    expect(cache.read("c", 4)?.value).toBe(3);
    expect(cache.size).toBe(2);
  });

  it("refreshing a key moves it to the newest position", () => {
    const cache = new TimedCache<number>(2);
    cache.write("a", 1, 1);
    cache.write("b", 2, 2);
    cache.write("a", 3, 3);
    cache.write("c", 4, 4);
    expect(cache.read("a", 5)?.value).toBe(3);
    expect(cache.read("b", 5)).toBeNull();
  });
});
