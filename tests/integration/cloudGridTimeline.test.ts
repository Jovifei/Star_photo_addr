// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CLOUD_STATE } from "@/lib/constants";
import { normalizeEpochHours } from "@/lib/absoluteForecastTime";
import type { useStore } from "@/lib/store";

type StoreValue = ReturnType<typeof useStore>;
const store = vi.hoisted(() => ({ current: null as StoreValue | null }));
vi.mock("@/lib/store", () => ({ useStore: () => store.current! }));
import CloudTimeline from "@/components/CloudTimeline";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); store.current = null; });

function setup(selectedPoint: boolean, stale = false) {
  const epoch = Date.parse("2026-10-09T12:00:00Z") / 1000;
  const forecasts = ["Asia/Tokyo", "Asia/Shanghai"].map((timezone, index) => ({
    timezone, metadata: { model: "icon", timeAxisVersion: "epoch-v1" },
    hourly: normalizeEpochHours([epoch], timezone).map(hour => ({ ...hour,
      cloudCover: index ? 80 : 20, precipitation: 0, windSpeed: 2, windDirection: 90,
      visibility: 20000, temperature: 10, humidity: 40, dewPoint: 0,
    })),
  }));
  store.current = {
    state: {
      forecastWindowStart: "2026-10-09T20:00", selectedNight: "2026-10-09", mapWorkspace: "tonight",
      selectedLocation: selectedPoint ? { id: "point", latitude: 31, longitude: 121, timezone: "Asia/Shanghai" } : null,
      forecast: null, cloudGrid: { model: "icon", forecasts, stale, sourceFetchedAt: "2026-10-09T10:00:00Z" },
      cloudState: { ...DEFAULT_CLOUD_STATE, activeForecastTime: "2026-10-09T20:00", activeForecastEpoch: epoch },
      satelliteFrames: [], cloudGridLoading: false,
    },
    setCloud: vi.fn(), selectNight: vi.fn(),
  } as unknown as StoreValue;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
  return render(createElement(CloudTimeline));
}

describe("live grid timeline fallback", () => {
  it("uses catalog clock and real grid averages, never the first cell's local label/value", () => {
    const { container } = setup(false);
    expect(container.querySelector('.cloud-tick[title="10/9 20:00"]')).not.toBeNull();
    expect(container.querySelector(".cloud-timeline-data-card")?.textContent).toContain("云量 50%");
    expect(container.querySelector(".cloud-timeline-data-card")?.textContent).toContain("2026-10-09 20:00");
    expect(container.querySelector(".cloud-timeline-data-card")?.textContent).toContain("地图采样网格平均");
  });

  it.each([{ selectedPoint: true, stale: false }, { selectedPoint: false, stale: true }])(
    "withholds weather recommendation score for unavailable point or degraded grid: %o", ({ selectedPoint, stale }) => {
      const { container } = setup(selectedPoint, stale);
      fireEvent.click(screen.getByRole("button", { name: "展开逐小时预报" }));
      const score = [...container.querySelectorAll(".cloud-summary-card > span")].find(element => element.querySelector("b")?.textContent === "时次天气分");
      expect(score?.textContent).toBe("时次天气分—");
      expect(container.querySelector(".cloud-timeline-data-card")?.textContent).toContain("云量 50%");
    },
  );
});
