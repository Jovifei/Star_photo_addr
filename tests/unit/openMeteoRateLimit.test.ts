import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.useRealTimers(); vi.resetModules(); vi.unstubAllEnvs(); });

describe("provider quota cooldown", () => {
  it("preserves a daily cooldown over a process restart without accepting an excessive deadline", async () => {
    vi.resetModules();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "quota-test-"));
    vi.stubEnv("OBSERVING_SNAPSHOT_DIR", directory);
    vi.stubEnv("FINDER_ENABLE_DISK_CACHE", "1");
    try {
      const first = await import("@/lib/forecast");
      first.noteOpenMeteoRateLimit("3600", "Daily API request limit exceeded");
      vi.resetModules();
      const restarted = await import("@/lib/forecast");
      expect(restarted.currentOpenMeteoRateLimit()?.dailyLimit).toBe(true);
      expect(restarted.currentOpenMeteoRateLimit()!.retryAfterMs).toBeLessThanOrEqual(3_600_000);
      fs.writeFileSync(path.join(directory, "weather-quota-cooldown-v1.json"), JSON.stringify({ version: 1, until: Date.now() + 2 * 86_400_000, dailyLimit: true }));
      vi.resetModules();
      expect((await import("@/lib/forecast")).currentOpenMeteoRateLimit()).toBeNull();
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  });

  it("stops all provider calls for a daily quota window", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { noteOpenMeteoRateLimit, withOpenMeteoProviderSlot } = await import("@/lib/forecast");
    const error = noteOpenMeteoRateLimit(null, "Daily API request limit exceeded. Please try again tomorrow.");
    expect(error.dailyLimit).toBe(true);
    expect(error.retryAfterMs).toBe(86_400_000);
    const request = vi.fn(async () => "ok");
    await vi.advanceTimersByTimeAsync(120_000);
    await expect(withOpenMeteoProviderSlot(request)).rejects.toMatchObject({ dailyLimit: true });
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(86_280_000);
    await expect(withOpenMeteoProviderSlot(request)).resolves.toBe("ok");
  });

  it("honors an explicit daily quota reset supplied by the provider", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { noteOpenMeteoRateLimit } = await import("@/lib/forecast");
    expect(noteOpenMeteoRateLimit("3600", "Daily API request limit exceeded").retryAfterMs).toBe(3_600_000);
  });

  it("preserves long provider Retry-After even when the rate-limit reason is missing", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { noteOpenMeteoRateLimit, withOpenMeteoProviderSlot } = await import("@/lib/forecast");
    expect(noteOpenMeteoRateLimit("3600").retryAfterMs).toBe(3_600_000);
    await vi.advanceTimersByTimeAsync(120_000);
    const request = vi.fn(async () => "ok");
    await expect(withOpenMeteoProviderSlot(request)).rejects.toMatchObject({ dailyLimit: false });
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps temporary concurrency limits short and obeys Retry-After", async () => {
    vi.resetModules();
    vi.useFakeTimers();
    const { noteOpenMeteoRateLimit, withOpenMeteoProviderSlot } = await import("@/lib/forecast");
    expect(noteOpenMeteoRateLimit("60", "Too many concurrent requests").retryAfterMs).toBe(60_000);
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(withOpenMeteoProviderSlot(async () => "ok")).resolves.toBe("ok");
  });
});
