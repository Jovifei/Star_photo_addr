import { describe, expect, it } from "vitest";
import {
  buildLightPollutionRedirect,
  buildProductHref,
  buildSitesRedirect,
} from "@/lib/productRoutes";

describe("buildProductHref", () => {
  it("builds one canonical cross-workspace observation context", () => {
    const result = buildProductHref("/planner", {
      location: {
        latitude: 30.1234,
        longitude: 120.5678,
        name: "东白山 观测点",
        elevation: 1188,
      },
      night: "2026-08-20",
      model: "gfs",
      forecastTime: "2026-08-20T21:00",
      observationTime: "2026-08-19T18:00",
      overlay: "forecast-cloud",
    });
    const target = new URL(result, "https://example.test");

    expect(target.pathname).toBe("/planner");
    expect(target.searchParams.get("lat")).toBe("30.1234");
    expect(target.searchParams.get("lng")).toBe("120.5678");
    expect(target.searchParams.get("name")).toBe("东白山 观测点");
    expect(target.searchParams.get("elevation")).toBe("1188");
    expect(target.searchParams.get("night")).toBe("2026-08-20");
    expect(target.searchParams.get("model")).toBe("gfs");
    expect(target.searchParams.get("forecastTime")).toBe("2026-08-20T21:00");
    expect(target.searchParams.get("observationTime")).toBe("2026-08-19T18:00");
    expect(target.searchParams.get("overlay")).toBe("forecast-cloud");
  });

  it("keeps the home map tonight-first while preserving the rest of the session", () => {
    const result = buildProductHref(
      "/",
      {
        location: {
          latitude: 31.2,
          longitude: 121.5,
          name: "上海",
          elevation: 4,
        },
        night: "2026-08-25",
        model: "aifs",
        overlay: "satellite-cloud",
      },
      { includeNight: false },
    );
    const target = new URL(result, "https://example.test");

    expect(target.pathname).toBe("/");
    expect(target.searchParams.has("night")).toBe(false);
    expect(target.searchParams.get("lat")).toBe("31.2");
    expect(target.searchParams.get("model")).toBe("aifs");
    expect(target.searchParams.get("overlay")).toBe("satellite-cloud");
  });

  it("does not emit a partial or invalid coordinate pair", () => {
    const result = buildProductHref("/sites", {
      location: {
        latitude: Number.NaN,
        longitude: 120.5,
        name: "无效点位",
        elevation: 10,
      },
      model: "icon",
    });
    const target = new URL(result, "https://example.test");

    expect(target.searchParams.has("lat")).toBe(false);
    expect(target.searchParams.has("lng")).toBe(false);
    expect(target.searchParams.has("name")).toBe(false);
    expect(target.searchParams.get("model")).toBe("icon");
  });
});

describe("buildLightPollutionRedirect", () => {
  it("preserves an old bookmark's observation context without opening the sites panel", () => {
    const result = buildLightPollutionRedirect({
      lat: "29.447",
      lng: "118.579",
      name: "开化暗夜点",
      elevation: "980",
      model: "aifs",
      forecastTime: "2026-08-20T22:00",
      overlay: "night-lights",
      unsafeReturnTo: "https://example.com",
    });
    const target = new URL(result, "https://example.test");

    expect(target.pathname).toBe("/");
    expect(target.searchParams.get("lat")).toBe("29.447");
    expect(target.searchParams.get("lng")).toBe("118.579");
    expect(target.searchParams.get("name")).toBe("开化暗夜点");
    expect(target.searchParams.get("elevation")).toBe("980");
    expect(target.searchParams.get("model")).toBe("aifs");
    expect(target.searchParams.get("forecastTime")).toBe("2026-08-20T22:00");
    expect(target.searchParams.get("overlay")).toBe("night-lights");
    expect(target.searchParams.get("view")).toBe("light-pollution");
    expect(target.searchParams.has("panel")).toBe(false);
    expect(target.searchParams.has("unsafeReturnTo")).toBe(false);
  });
});

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
