/** Process-local admission control. It cannot reset the provider/account quota. */
const MINUTE = 60_000;

export function rateLimitDelayMs(retryAfter: string | null, reason = "", now = Date.now()): number {
  const value = retryAfter?.trim();
  if (value) {
    const seconds = /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
    if (Number.isFinite(seconds)) return Math.max(1_000, seconds * 1_000);
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp > now) return timestamp - now;
  }
  // These are conservative backoffs, not assertions about the provider reset time.
  if (/daily|day\b/i.test(reason)) return 24 * 60 * MINUTE;
  if (/hourly|hour\b/i.test(reason)) return 60 * MINUTE;
  return 65_000;
}

export class OpenMeteoRateLimitError extends Error {
  readonly retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Open-Meteo HTTP 429：限流冷却中，请 ${Math.ceil(retryAfterMs / 1000)} 秒后重试`);
    this.name = "OpenMeteoRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

type Task = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
};

/** Reject queued work during cooldown instead of automatically retrying it. */
export class OpenMeteoGate {
  private active = 0;
  private cooldownUntil = 0;
  private readonly queue: Task[] = [];
  private readonly now: () => number;
  private readonly concurrency: number;

  constructor(concurrency = 2, now: () => number = Date.now) {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Invalid provider concurrency");
    this.concurrency = concurrency;
    this.now = now;
  }

  remainingMs(): number {
    return Math.max(0, this.cooldownUntil - this.now());
  }

  noteRateLimit(retryAfter: string | null, reason = ""): void {
    this.cooldownUntil = Math.max(this.cooldownUntil,
      this.now() + rateLimitDelayMs(retryAfter, reason, this.now()));
    // Set the circuit before releasing the fetch slot, closing the 429 race.
    while (this.queue.length) this.queue.shift()!.reject(new OpenMeteoRateLimitError(this.remainingMs()));
  }

  run<T>(run: () => Promise<T>): Promise<T> {
    const remaining = this.remainingMs();
    if (remaining) return Promise.reject(new OpenMeteoRateLimitError(remaining));
    if (this.queue.length >= 128) return Promise.reject(new Error("Open-Meteo 请求队列已满，请稍后重试"));
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ run, resolve: resolve as (value: unknown) => void, reject });
      this.drain();
    });
  }

  private drain(): void {
    while (this.active < this.concurrency && this.queue.length) {
      const task = this.queue.shift()!;
      const remaining = this.remainingMs();
      if (remaining) {
        task.reject(new OpenMeteoRateLimitError(remaining));
        continue;
      }
      this.active += 1;
      void Promise.resolve().then(task.run).then(async (value) => {
        if (value instanceof Response && value.status === 429) {
          const retryAfter = value.headers.get("Retry-After");
          this.noteRateLimit(retryAfter);
          const body: unknown = await value.clone().json().catch(() => null);
          const reason = body && typeof body === "object" && "reason" in body && typeof body.reason === "string"
            ? body.reason : "";
          this.noteRateLimit(retryAfter, reason);
          throw new OpenMeteoRateLimitError(this.remainingMs());
        }
        return value;
      }).then(task.resolve, task.reject).finally(() => {
        this.active -= 1;
        this.drain();
      });
    }
  }
}

const providerGate = new OpenMeteoGate();
export function withOpenMeteoProviderSlot<T>(run: () => Promise<T>): Promise<T> {
  return providerGate.run(run);
}
export function noteOpenMeteoRateLimit(retryAfter: string | null, reason = ""): void {
  providerGate.noteRateLimit(retryAfter, reason);
}
export function openMeteoCooldownRemainingMs(): number {
  return providerGate.remainingMs();
}
