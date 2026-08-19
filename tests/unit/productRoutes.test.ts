import { describe, expect, it } from "vitest";
import { buildSitesRedirect } from "@/lib/productRoutes";

describe("buildSitesRedirect", () => {
  it("preserves the observation session while opening the canonical sites view", () => {
    const result = buildSitesRedirect({
      lat: "30.1234",
      lng: "120.5678",
      name: "东白山 观测点",
      elevation: "1188",
      night: "2026-08-20",
      model: "gfs",
      forecastTime: "2026-08-20T21:00",
      observationTime: "2026-08-19T18:00",
      overlay: "forecast-cloud",
    });
    const target = new URL(result, "https://example.test");

    expect(target.pathname).toBe("/");
    expect(target.searchParams.get("lat")).toBe("30.1234");
    expect(target.searchParams.get("lng")).toBe("120.5678");
    expect(target.searchParams.get("name")).toBe("东白山 观测点");
    expect(target.searchParams.get("elevation")).toBe("1188");
    expect(target.searchParams.get("night")).toBe("2026-08-20");
    expect(target.searchParams.get("model")).toBe("gfs");
    expect(target.searchParams.get("forecastTime")).toBe("2026-08-20T21:00");
    expect(target.searchParams.get("observationTime")).toBe("2026-08-19T18:00");
    expect(target.searchParams.get("overlay")).toBe("forecast-cloud");
    expect(target.searchParams.get("view")).toBe("light-pollution");
    expect(target.searchParams.get("panel")).toBe("sites");
  });

  it("uses the first non-empty repeated value and ignores unrelated parameters", () => {
    const result = buildSitesRedirect({
      name: ["", "临安观测点", "备用名称"],
      model: "icon",
      returnTo: "https://example.com/should-not-be-reflected",
    });
    const target = new URL(result, "https://example.test");

    expect(target.searchParams.get("name")).toBe("临安观测点");
    expect(target.searchParams.get("model")).toBe("icon");
    expect(target.searchParams.has("returnTo")).toBe(false);
    expect(target.searchParams.get("view")).toBe("light-pollution");
    expect(target.searchParams.get("panel")).toBe("sites");
  });
});
