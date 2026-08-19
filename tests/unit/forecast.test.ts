import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildForecastUrl,
  clampForecastDays,
  fetchSurfaceForecasts,
  maxForecastDaysForModel,
  openMeteoModelParameter,
  parseProviderTime,
} from "@/lib/forecast";

afterEach(() => vi.restoreAllMocks());

describe("parseProviderTime — 本地墙钟还原真 UTC", () => {
  it("16 位输入无秒也正确补零", () => {
    expect(parseProviderTime("2026-08-13T04:00", 0).toISOString()).toBe(
      "2026-08-13T04:00:00.000Z",
    );
  });

  it("China +8：本地 04:00 → UTC 前日 20:00", () => {
    expect(
      parseProviderTime("2026-08-13T04:00", 28800).toISOString(),
    ).toBe("2026-08-12T20:00:00.000Z");
  });

  it("China +8：本地 20:00 → UTC 同日 12:00", () => {
    expect(
      parseProviderTime("2026-08-12T20:00", 28800).toISOString(),
    ).toBe("2026-08-12T12:00:00.000Z");
  });

  it("负偏移方向正确", () => {
    expect(
      parseProviderTime("2026-08-13T04:00", -18000).toISOString(),
    ).toBe("2026-08-13T09:00:00.000Z");
  });

  it("19 位输入原样处理", () => {
    expect(parseProviderTime("2026-08-13T04:00:00", 0).toISOString()).toBe(
      "2026-08-13T04:00:00.000Z",
    );
  });
});

describe("forecast model routing", () => {
  const location = {
    id: "x",
    name: "",
    latitude: 30,
    longitude: 120,
    elevation: 0,
    source: "搜索" as const,
  };

  it("maps named models to Open-Meteo model parameters", () => {
    expect(openMeteoModelParameter("best_match")).toBeNull();
    expect(openMeteoModelParameter("icon")).toBe("icon_seamless");
    expect(openMeteoModelParameter("gfs")).toBe("gfs_seamless");
    expect(openMeteoModelParameter("aifs")).toBe(
      "ecmwf_aifs025_single",
    );
    expect(buildForecastUrl([location], 2, "gfs")).toContain(
      "models=gfs_seamless",
    );
    expect(buildForecastUrl([location], 2, "aifs")).toContain(
      "models=ecmwf_aifs025_single",
    );
    expect(buildForecastUrl([location], 2, "best_match")).not.toContain(
      "models=",
    );
  });

  it("clamps forecast_days to each provider horizon", () => {
    expect(maxForecastDaysForModel("icon")).toBe(8);
    expect(maxForecastDaysForModel("gfs")).toBe(16);
    expect(maxForecastDaysForModel("aifs")).toBe(15);
    expect(clampForecastDays(14, "icon")).toBe(8);
    expect(clampForecastDays(30, "gfs")).toBe(16);
    expect(clampForecastDays(30, "aifs")).toBe(15);
    expect(
      new URL(buildForecastUrl([location], 14, "icon")).searchParams.get(
        "forecast_days",
      ),
    ).toBe("8");
  });

  it("rejects incomplete multi-location responses instead of duplicating one location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          latitude: 30,
          longitude: 120,
          elevation: 0,
          timezone: "Asia/Shanghai",
          utc_offset_seconds: 28800,
          hourly: { time: [] },
        }),
      }),
    );
    const locations = [
      { ...location, id: "a", name: "A" },
      { ...location, id: "b", name: "B", latitude: 31, longitude: 121 },
    ];
    await expect(fetchSurfaceForecasts(locations, 1)).rejects.toThrow(
      "响应数量不匹配",
    );
  });

  it("rejects a response that has times but no valid total cloud values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          latitude: 30,
          longitude: 120,
          elevation: 0,
          timezone: "Asia/Shanghai",
          utc_offset_seconds: 28800,
          hourly: { time: ["2026-08-19T20:00"], cloud_cover: [null] },
        }),
      }),
    );
    await expect(fetchSurfaceForecasts([location], 1)).rejects.toThrow(
      "有效总云量",
    );
  });

  it("always fetches the upstream with no-store semantics", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        latitude: 30,
        longitude: 120,
        elevation: 0,
        timezone: "Asia/Shanghai",
        utc_offset_seconds: 28800,
        hourly: {
          time: ["2026-08-19T20:00"],
          cloud_cover: [15],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchSurfaceForecasts([location], 1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
