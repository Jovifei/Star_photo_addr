export interface RefreshDecision {
  requested: boolean;
  suppressed: boolean;
  effective: boolean;
  retryAfterSeconds: number | null;
}

/**
 * Small process-local coordinator for public read-only endpoints.
 *
 * It centralizes two rules repeated across route handlers:
 * 1. identical concurrent requests share one upstream Promise;
 * 2. `refresh=1` cannot repeatedly bypass the route cache.
 *
 * CDN/browser caching remains the first line of defence. This class protects a
 * single Next.js process, which is the correct boundary for a small ECS/Compose
 * deployment and remains safe when multiple instances are added later.
 */
export class RefreshCoordinator<T> {
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly lastForcedAt = new Map<string, number>();

  constructor(
    private readonly cooldownMs: number,
    private readonly maxEntries = 128,
  ) {}

  decide(
    key: string,
    requested: boolean,
    now = Date.now(),
  ): RefreshDecision {
    const lastForced = this.lastForcedAt.get(key) ?? 0;
    const suppressed =
      requested && now - lastForced < this.cooldownMs;
    if (requested && !suppressed) {
      this.lastForcedAt.delete(key);
      this.lastForcedAt.set(key, now);
      this.trimForcedHistory();
    }
    return {
      requested,
      suppressed,
      effective: requested && !suppressed,
      retryAfterSeconds: suppressed
        ? Math.max(
            1,
            Math.ceil((lastForced + this.cooldownMs - now) / 1000),
          )
        : null,
    };
  }

  hasInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  run(
    key: string,
    factory: () => Promise<T>,
  ): { promise: Promise<T>; coalesced: boolean } {
    const existing = this.inFlight.get(key);
    if (existing) return { promise: existing, coalesced: true };

    const promise = Promise.resolve().then(factory);
    this.inFlight.set(key, promise);
    void promise
      .finally(() => {
        if (this.inFlight.get(key) === promise) {
          this.inFlight.delete(key);
        }
      })
      .catch(() => undefined);
    return { promise, coalesced: false };
  }

  private trimForcedHistory(): void {
    while (this.lastForcedAt.size > this.maxEntries) {
      const oldest = this.lastForcedAt.keys().next().value as
        | string
        | undefined;
      if (oldest === undefined) break;
      this.lastForcedAt.delete(oldest);
    }
  }
}
