import { NextRequest } from "next/server";
import { afterEach, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it.each(["fireglow", "cloudsea"])("%s cache-only misses never dispatch supplier requests", async product => {
  vi.resetModules();
  const supplier = vi.fn(() => { throw new Error("unexpected supplier request"); });
  vi.stubGlobal("fetch", supplier);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  const route = product === "fireglow" ? await import("@/app/api/fireglow/snapshot/route") : await import("@/app/api/cloudsea/snapshot/route");
  const response = await route.GET(new NextRequest("http://localhost/api/" + product + "/snapshot?date=" + date + "&model=gfs&cache_only=1&refresh=1"));
  expect(response.status).toBe(429);
  expect((await response.json()).error).toBe("cache-only-miss");
  expect(supplier).not.toHaveBeenCalled();
});
