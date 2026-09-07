import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPressureForecastBatchUrl,
  fetchPressureForecast,
  fetchPressureForecastBatch,
  parsePressureForecast,
  PRESSURE_LEVELS,
} from "@/lib/pressure";

function rawPressure(options: { brokenLevels?: number } = {}) {
  const time = ["2026-09-08T05:00", "2026-09-08T06:00"];
  const hourly: Record<string, unknown> = {
    time,
    temperature_2m: [10, 11],
  };
  const brokenLevels = options.brokenLevels ?? 0;
  PRESSURE_LEVELS.forEach((level, index) => {
    hourly[`cloud_cover_${level}hPa`] = [70 - index, 72 - index];
    hourly[`relative_humidity_${level}hPa`] =
      index < brokenLevels ? [88] : [88 - index, 87 - index];
    hourly[`temperature_${level}hPa`] = [9 - index * 1.5, 10 - index * 1.5];
    hourly[`geopotential_height_${level}hPa`] = [
      120 + index * 500,
      125 + index * 500,
    ];
  });
  return {
    elevation: 980,
    timezone: "Asia/Shanghai",
    utc_offset_seconds: 28800,
    hourly,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pressure forecast batch", () => {
  it("builds a bounded multi-coordinate URL with only pressure-profile fields", () => {
    const url = new URL(
      buildPressureForecastBatchUrl(
        [
          { id: "a", latitude: 30.1, longitude: 119.2 },
          { id: "b", latitude: 29.8, longitude: 102.4 },
        ],
        "2026-09-08",
        "aifs",
      ),
    );
    expect(url.searchParams.get("latitude")).toBe("30.1,29.8");
    expect(url.searchParams.get("longitude")).toBe("119.2,102.4");
    expect(url.searchParams.get("start_date")).toBe("2026-09-08");
    expect(url.searchParams.get("end_date")).toBe("2026-09-08");
    expect(url.searchParams.get("models")).toBe("ecmwf_aifs025_single");
    const hourly = url.searchParams.get("hourly") ?? "";
    expect(hourly).toContain("temperature_2m");
    expect(hourly).toContain("cloud_cover_1000hPa");
    expect(hourly).toContain("relative_humidity_925hPa");
    expect(hourly).toContain("geopotential_height_500hPa");
    expect(hourly).not.toContain("visibility");
  });

  it("requires at least six fully aligned pressure levels", () => {
    expect(() => parsePressureForecast(rawPressure(), "site-a", "icon")).not.toThrow();
    expect(() =>
      parsePressureForecast(rawPressure({ brokenLevels: 5 }), "site-a", "icon"),
    ).toThrow(/5 个完整可用层/);
  });

  it("isolates one malformed site without discarding valid peers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify([rawPressure(), { elevation: 1200 }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const result = await fetchPressureForecastBatch(
      [
        { id: "good", latitude: 30.1, longitude: 119.2 },
        { id: "bad", latitude: 30.2, longitude: 119.3 },
      ],
      "2026-09-08",
      undefined,
      "icon",
    );
    expect(result.data.good?.locationId).toBe("good");
    expect(result.data.bad).toBeUndefined();
    expect(result.errors.bad).toContain("hourly");
  });

  it("fails closed when upstream coordinate count does not match the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify([rawPressure()]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(
      fetchPressureForecastBatch(
        [
          { id: "a", latitude: 30.1, longitude: 119.2 },
          { id: "b", latitude: 30.2, longitude: 119.3 },
        ],
        "2026-09-08",
      ),
    ).rejects.toThrow(/返回 1 个地点.*请求的 2 个地点不匹配/);
  });

  it("keeps the legacy single-point fetch response contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify(rawPressure()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    const result = await fetchPressureForecast(30.1, 119.2, 1, undefined, "icon");
    expect(result.locationId).toBe("pressure");
    expect(result.source).toBe("Open-Meteo");
    expect(result.model).toBe("icon");
    expect(result.profiles["2026-09-08T05:00"]).toHaveLength(PRESSURE_LEVELS.length);
  });
});
