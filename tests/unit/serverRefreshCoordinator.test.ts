import { describe, expect, it, vi } from "vitest";
import { RefreshCoordinator } from "@/lib/serverRefreshCoordinator";

describe("RefreshCoordinator", () => {
  it("suppresses repeated forced refreshes until the cooldown expires", () => {
    const coordinator = new RefreshCoordinator<string>(60_000);
    expect(coordinator.decide("weather", true, 100_000)).toEqual({
      requested: true,
      suppressed: false,
      effective: true,
      retryAfterSeconds: null,
    });
    expect(coordinator.decide("weather", true, 110_000)).toEqual({
      requested: true,
      suppressed: true,
      effective: false,
      retryAfterSeconds: 50,
    });
    expect(coordinator.decide("weather", true, 160_000).effective).toBe(true);
  });

  it("coalesces identical concurrent work and releases it afterwards", async () => {
    const coordinator = new RefreshCoordinator<number>(60_000);
    let resolveTask;
    const factory = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveTask = resolve;
        }),
    );

    const first = coordinator.run("same", factory);
    const second = coordinator.run("same", factory);
    expect(first.coalesced).toBe(false);
    expect(second.coalesced).toBe(true);
    expect(second.promise).toBe(first.promise);
    expect(factory).toHaveBeenCalledTimes(1);

    resolveTask(42);
    await expect(first.promise).resolves.toBe(42);
    await Promise.resolve();

    const third = coordinator.run("same", async () => 7);
    expect(third.coalesced).toBe(false);
    await expect(third.promise).resolves.toBe(7);
  });
});
