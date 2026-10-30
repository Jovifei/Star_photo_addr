import { afterEach, describe, expect, it, vi } from "vitest";
import { providerUnits } from "../fixtures/providerUnits";
import {
  buildPressureForecastBatchUrl,
  fetchPressureForecast,
  fetchPressureForecastBatch,
  hasUsablePressureProfile,
  parsePressureForecast,
  PRESSURE_LEVELS,
} from "@/lib/pressure";

function rawPressure(
  options: {
    brokenLevels?: number;
    sparseSecondHourLevels?: number;
    omitElevation?: boolean;
  } = {},
) {
  const time = ["2026-09-08T05:00", "2026-09-08T06:00"];
  const hourly: Record<string, unknown> = {
    time,
    temperature_2m: [10, 11],
  };
  const brokenLevels = options.brokenLevels ?? 0;
  const sparseSecondHourLevels = options.sparseSecondHourLevels ?? 0;
  PRESSURE_LEVELS.forEach((level, index) => {
    const secondHourMissing = index < sparseSecondHourLevels;
    hourly[`cloud_cover_${level}hPa`] = [
      70 - index,
      secondHourMissing ? null : 72 - index,
    ];
    if (index >= brokenLevels) {
      hourly[`relative_humidity_${level}hPa`] = [
        88 - index,
        secondHourMissing ? null : 87 - index,
      ];
    }
    hourly[`temperature_${level}hPa`] = [
      9 - index * 1.5,
      secondHourMissing ? null : 10 - index * 1.5,
    ];
    hourly[`geopotential_height_${level}hPa`] = [
      120 + index * 500,
      secondHourMissing ? null : 125 + index * 500,
    ];
  });
  return {
    ...(options.omitElevation ? {} : { elevation: 980 }),
    latitude: 30.1,
    longitude: 119.2,
    timezone: "Asia/Shanghai",
    utc_offset_seconds: 28800,
    hourly_units: providerUnits(),
    hourly,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("pressure forecast batch", () => {
  it("shares the provider cooldown and does not retry a throttle", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() - 60_000);
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return new Response(JSON.stringify({ reason: "rate limited" }), {
            status: 429,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify([rawPressure()]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const location = [{ id: "retry", latitude: 30.1, longitude: 119.2 }];
    await expect(fetchPressureForecastBatch(location, "2026-09-08", undefined, "icon"))
      .rejects.toThrow(/限流冷却/);
    expect(calls).toBe(1);
    await expect(fetchPressureForecastBatch(location, "2026-09-08", undefined, "icon"))
      .rejects.toThrow(/限流冷却/);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(30_001);
    await expect(fetchPressureForecastBatch(location, "2026-09-08", undefined, "icon"))
      .resolves.toEqual(expect.objectContaining({ data: expect.objectContaining({ retry: expect.any(Object) }) }));
    expect(calls).toBe(2);
  });

  it("aborts a stuck provider attempt and retries with a fresh request signal", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
        calls += 1;
        if (calls === 1) {
          return await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => reject(init.signal?.reason ?? new DOMException("aborted", "AbortError")),
              { once: true },
            );
          });
        }
        return new Response(JSON.stringify([rawPressure()]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );

    const pending = fetchPressureForecastBatch(
      [{ id: "timeout-retry", latitude: 30.1, longitude: 119.2 }],
      "2026-09-08",
      undefined,
      "best_match",
    );
    await vi.advanceTimersByTimeAsync(11_999);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(301);
    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        data: expect.objectContaining({ "timeout-retry": expect.any(Object) }),
      }),
    );
    expect(calls).toBe(2);
  });

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

  it("requires at least six fully aligned pressure-level series", () => {
    expect(() => parsePressureForecast(rawPressure(), "site-a", "icon")).not.toThrow();
    expect(() =>
      parsePressureForecast(rawPressure({ brokenLevels: PRESSURE_LEVELS.length - 5 }), "site-a", "icon"),
    ).toThrow(/5 个完整可用层/);
  });

  it("requires provider elevation instead of silently substituting sea level", () => {
    expect(() =>
      parsePressureForecast(rawPressure({ omitElevation: true }), "site-a", "icon"),
    ).toThrow(/elevation.*缺失/);
  });

  it("tracks hourly profile completeness separately from aligned day-level arrays", () => {
    const parsed = parsePressureForecast(
      rawPressure({ sparseSecondHourLevels: PRESSURE_LEVELS.length - 5 }),
      "site-a",
      "icon",
    );
    expect(hasUsablePressureProfile(parsed.profiles["2026-09-08T05:00"])).toBe(true);
    expect(hasUsablePressureProfile(parsed.profiles["2026-09-08T06:00"])).toBe(false);
  });

  it("rejects a response whose whole day has no hour with six complete levels", () => {
    expect(() =>
      parsePressureForecast(
        rawPressure({ sparseSecondHourLevels: PRESSURE_LEVELS.length, brokenLevels: 0 }),
        "site-a",
        "icon",
      ),
    ).not.toThrow();

    const raw = rawPressure();
    const hourly = raw.hourly as Record<string, unknown>;
    for (const level of PRESSURE_LEVELS) {
      hourly[`cloud_cover_${level}hPa`] = [null, null];
      hourly[`relative_humidity_${level}hPa`] = [null, null];
      hourly[`temperature_${level}hPa`] = [null, null];
      hourly[`geopotential_height_${level}hPa`] = [null, null];
    }
    expect(() => parsePressureForecast(raw, "site-a", "icon")).toThrow(
      /没有任何小时具备至少 6 个完整压力层/,
    );
  });

  it.each(["timezone", "offset", "latitude", "longitude"] as const)(
    "rejects one pressure batch site with invalid %s while preserving a trustworthy peer",
    async (fault) => {
      const bad = rawPressure();
      if (fault === "timezone") bad.timezone = "UTC";
      if (fault === "offset") bad.utc_offset_seconds = 0;
      if (fault === "latitude") bad.latitude = 91;
      if (fault === "longitude") bad.longitude = 181;
      vi.stubGlobal("fetch", vi.fn(async () => Response.json([rawPressure(), bad])));

      const result = await fetchPressureForecastBatch(
        [
          { id: "good", latitude: 30.1, longitude: 119.2 },
          { id: "bad", latitude: 30.2, longitude: 119.3 },
        ],
        "2026-09-08",
        undefined,
        "gfs",
      );
      expect(result.data.good?.model).toBe("gfs");
      expect(result.data.bad).toBeUndefined();
      expect(result.errors.bad).toMatch(/时区|坐标/);
    },
  );

  it("does not report a valid epoch pressure profile for the wrong requested Shanghai calendar day", async () => {
    const buildEpoch = (date: string) => {
      const row = rawPressure();
      row.hourly.time = [5, 6].map((hour) =>
        Date.parse(`${date}T${String(hour).padStart(2, "0")}:00:00+08:00`) / 1000,
      );
      row.hourly_units = providerUnits("unixtime");
      return row;
    };
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json([buildEpoch("2026-09-08"), buildEpoch("2026-09-09")]),
    ));
    const result = await fetchPressureForecastBatch(
      [
        { id: "same-day", latitude: 30.1, longitude: 119.2 },
        { id: "wrong-day", latitude: 30.2, longitude: 119.3 },
      ],
      "2026-09-08",
      undefined,
      "gfs",
    );
    expect(result.data["same-day"]?.stale).toBe(false);
    expect(result.data["same-day"]?.hourly.map(hour => hour.time)).toEqual([
      "2026-09-08T05:00",
      "2026-09-08T06:00",
    ]);
    expect(result.data["wrong-day"]).toBeUndefined();
    expect(result.errors["wrong-day"]).toMatch(/目标日期|日期/);
  });

  it("isolates one malformed site without discarding valid peers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify([rawPressure(), { ...rawPressure(), hourly: null }]), {
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
    expect(result.profiles["2026-09-08T05:00"]).toHaveLength(
      PRESSURE_LEVELS.length,
    );
  });
});


describe("pressure time axis integrity", () => {
  it("rejects duplicate, descending and malformed times", () => {
    for (const time of [["2026-09-08T05:00", "2026-09-08T05:00"], ["2026-09-08T06:00", "2026-09-08T05:00"], ["garbage", "more"]]) {
      const raw = rawPressure();
      raw.hourly.time = time;
      expect(() => parsePressureForecast(raw, "test", "icon")).toThrow(/时间轴/);
    }
  });
});
