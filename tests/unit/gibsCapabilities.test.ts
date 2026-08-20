import { afterEach, describe, expect, it, vi } from "vitest";

const XML = "<Capabilities><ResourceURL template=\"tile\" /></Capabilities>";

afterEach(() => {
  delete (globalThis as typeof globalThis & {
    __starPhotoGibsCapabilities?: unknown;
  }).__starPhotoGibsCapabilities;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("shared GIBS capabilities loader", () => {
  it("coalesces concurrent catalogue requests", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return new Response(XML, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getGibsCapabilities } = await import(
      "@/lib/server/gibsCapabilities"
    );
    const first = getGibsCapabilities();
    const second = getGibsCapabilities();
    release?.();
    const [one, two] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(one.xml).toBe(XML);
    expect(two.xml).toBe(XML);
    expect([one.cache, two.cache]).toContain("coalesced");
  });

  it("blocks repeated forced downloads when the cold catalogue request fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-20T00:00:00Z"));
    const fetchMock = vi.fn(async () => {
      throw new TypeError("network unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { GibsRefreshCooldownError, getGibsCapabilities } = await import(
      "@/lib/server/gibsCapabilities"
    );
    await expect(getGibsCapabilities(true)).rejects.toThrow(
      "network unavailable",
    );
    await expect(getGibsCapabilities(true)).rejects.toBeInstanceOf(
      GibsRefreshCooldownError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("serves the fresh in-process catalogue without another download", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(XML, {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getGibsCapabilities } = await import(
      "@/lib/server/gibsCapabilities"
    );
    expect((await getGibsCapabilities()).cache).toBe("refresh");
    expect((await getGibsCapabilities()).cache).toBe("memory");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
