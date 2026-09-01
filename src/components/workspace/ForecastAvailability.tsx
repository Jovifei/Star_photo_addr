"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useStore, FORECAST_SAMPLE_COOLDOWN_MS } from "@/lib/store";

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Explicit upstream-state line for the selected location's forecast: why the
 * hourly data is missing (429 / timeout), when the last successful update
 * arrived, and an actionable retry. Rendered in the decision summary and the
 * hourly panel so "—" never has to speak for an outage.
 */
export default function ForecastAvailability() {
  const { state, sampleAt } = useStore();
  const availability = state.forecastAvailability;
  const location = state.selectedLocation;

  // The store throttles repeat requests for the same location; mirror that
  // window here so the retry button visibly disables itself instead of
  // silently swallowing the click. Counted down by a timer, never Date.now()
  // during render.
  const [coolingDown, setCoolingDown] = useState(false);
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setTimeout(
      () => setCoolingDown(false),
      FORECAST_SAMPLE_COOLDOWN_MS,
    );
    return () => clearTimeout(timer);
  }, [coolingDown]);

  if (state.loading && !availability.error) {
    return (
      <p className="forecast-availability" role="status" data-testid="forecast-availability" data-tone="loading">
        <RefreshCw size={12} className="spin" aria-hidden="true" />
        正在读取该地点的逐小时预报…
      </p>
    );
  }

  if (!availability.error && !availability.lastSuccessAt) return null;

  if (availability.error) {
    const lastSuccess = formatTime(availability.lastSuccessAt);
    const tone = availability.staleInUse ? "stale" : "unavailable";
    return (
      <p
        className={`forecast-availability${availability.staleInUse ? " stale" : ""}`}
        role="status"
        data-testid="forecast-availability"
        data-tone={tone}
      >
        {availability.staleInUse ? (
          <>
            <b>使用最近成功数据</b>
            <span>
              刷新失败：{availability.error}；最近成功
              {lastSuccess ? ` ${lastSuccess}` : "时间未知"}。
            </span>
          </>
        ) : (
          <>
            <b>逐小时数据暂不可用</b>
            <span>
              原因：{availability.error}
              {lastSuccess ? `；最近成功 ${lastSuccess}` : "；暂无成功数据"}。
            </span>
          </>
        )}
        {location ? (
          <button
            type="button"
            className="text-button"
            disabled={coolingDown}
            title={coolingDown ? "刚请求过该地点，请稍候再试" : undefined}
            onClick={() => {
              setCoolingDown(true);
              void sampleAt(
                location.latitude,
                location.longitude,
                location.elevation ?? 0,
                location.name,
              );
            }}
          >
            <RefreshCw size={12} aria-hidden="true" />
            {coolingDown ? "稍候可重试" : "重试"}
          </button>
        ) : null}
      </p>
    );
  }

  const updated = formatTime(availability.lastSuccessAt);
  return (
    <p className="forecast-availability" role="status" data-testid="forecast-availability" data-tone="ready">
      数据更新 {updated ?? "时间未知"}
    </p>
  );
}
