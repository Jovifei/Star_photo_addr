export interface CacheHit<T> {
  value: T;
  savedAt: number;
  ageMs: number;
}

/**
 * Small bounded in-process cache for server route handlers.
 *
 * It is intentionally process-local: CDN/browser caching remains the first
 * line of defence, while this cache provides request de-duplication and a
 * stale fallback inside a single Next.js instance. Entries are evicted in
 * insertion order to prevent an unbounded map from growing on long-running
 * ECS instances.
 */
export class TimedCache<T> {
  private readonly entries = new Map<string, { value: T; savedAt: number }>();

  constructor(private readonly maxEntries = 128) {}

  read(key: string, now = Date.now()): CacheHit<T> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return {
      value: entry.value,
      savedAt: entry.savedAt,
      ageMs: Math.max(0, now - entry.savedAt),
    };
  }

  readFresh(key: string, ttlMs: number, now = Date.now()): CacheHit<T> | null {
    const hit = this.read(key, now);
    return hit && hit.ageMs <= ttlMs ? hit : null;
  }

  write(key: string, value: T, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, savedAt: now });
    while (this.entries.size > this.maxEntries) {
      const oldestKey = this.entries.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
