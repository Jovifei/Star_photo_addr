import { describe, expect, it, vi } from "vitest";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";

describe("RefreshCoordinator", () => {
  it("coalesces identical concurrent upstream work", async () => {
    const coordinator = new RefreshCoordinator<number>(60_000);
    let release: ((value: number) => void) | undefined;
    const firstFactory = vi.fn(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        }),
    );
    const secondFactory = vi.fn(async () => 2);

    const first = coordinator.run("same-key", firstFactory);
    const second = coordinator.run("same-key", secondFactory);

    expect(first.coalesced).toBe(false);
    expect(second.coalesced).toBe(true);
    expect(firstFactory).not.toHaveBeenCalled();
    expect(secondFactory).not.toHaveBeenCalled();

    await Promise.resolve();
    expect(firstFactory).toHaveBeenCalledTimes(1);
    release?.(1);

    await expect(first.promise).resolves.toBe(1);
    await expect(second.promise).resolves.toBe(1);
    expect(secondFactory).not.toHaveBeenCalled();
  });

  it("suppresses repeated forced refreshes and reports retry-after seconds", () => {
    const coordinator = new RefreshCoordinator<number>(60_000);

    expect(coordinator.decide("x", true, 100_000)).toEqual({
      requested: true,
      suppressed: false,
      effective: true,
      retryAfterSeconds: null,
    });
    expect(coordinator.decide("x", true, 120_000)).toEqual({
      requested: true,
      suppressed: true,
      effective: false,
      retryAfterSeconds: 40,
    });
    expect(coordinator.decide("x", true, 160_000).effective).toBe(true);
  });

  it("keeps cooldown and in-flight state isolated by cache key", async () => {
    const coordinator = new RefreshCoordinator<number>(60_000);
    coordinator.decide("a", true, 100_000);

    expect(coordinator.decide("b", true, 100_001).suppressed).toBe(false);

    const one = coordinator.run("a", async () => 1);
    const two = coordinator.run("b", async () => 2);
    await expect(one.promise).resolves.toBe(1);
    await expect(two.promise).resolves.toBe(2);
  });
});
