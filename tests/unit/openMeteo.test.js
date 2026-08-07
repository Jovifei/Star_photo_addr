import { describe, it, expect, vi, afterEach } from "vitest";
import { resolveForecastBase, providerUrl } from "../../src/lib/openMeteo.js";

afterEach(() => vi.unstubAllEnvs());

describe("resolveForecastBase (T1)", () => {
  it("defaults to same-origin /api/forecast when no env is set", () => {
    vi.stubEnv("VITE_FORECAST_BASE", undefined);
    expect(resolveForecastBase()).toBe("/api/forecast");
  });

  it("uses VITE_FORECAST_BASE verbatim when provided", () => {
    const custom = "https://api.open-meteo.com/v1/forecast";
    vi.stubEnv("VITE_FORECAST_BASE", custom);
    expect(resolveForecastBase()).toBe(custom);
  });
});

describe("providerUrl (T1)", () => {
  const locations = [{ id: "x", latitude: 30.02, longitude: 119.0 }];

  it("builds a same-origin URL with the default base and required params", () => {
    vi.stubEnv("VITE_FORECAST_BASE", undefined);
    const url = providerUrl(locations, 7, ["temperature_2m"]);
    expect(url.startsWith("/api/forecast?")).toBe(true);
    expect(url).toContain("latitude=30.02");
    expect(url).toContain("longitude=119");
    expect(url).toContain("hourly=temperature_2m");
    expect(url).toContain("timezone=Asia%2FShanghai");
  });

  it("builds a request URL prefixed by the resolved custom base", () => {
    const custom = "https://api.open-meteo.com/v1/forecast";
    vi.stubEnv("VITE_FORECAST_BASE", custom);
    const url = providerUrl(locations, 7, ["temperature_2m"]);
    expect(url.startsWith(`${custom}?`)).toBe(true);
    expect(url).toContain("latitude=30.02");
    expect(url).toContain("hourly=temperature_2m");
  });
});
