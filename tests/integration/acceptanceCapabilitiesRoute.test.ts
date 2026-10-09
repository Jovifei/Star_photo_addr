import { expect, it, vi } from "vitest";
import { GET } from "@/app/api/acceptance-capabilities/route";
it("declares cache-only support without fetching suppliers or probing weather routes", async () => {
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  try {
    const response = GET();
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({ app: "star-weather-planner", cacheOnlyVersion: 1, products: ["surface", "pressure", "fireglow", "cloudsea"] });
    expect(fetcher).not.toHaveBeenCalled();
  } finally { vi.unstubAllGlobals(); }
});
