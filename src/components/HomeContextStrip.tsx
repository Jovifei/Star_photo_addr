"use client";

import { useStore } from "@/lib/store";
import { formatHourWithDate, formatNightLabel } from "@/lib/nighttime";

function formatUpdateTime(value: string | null | undefined): string {
  if (!value) return "更新时间未知";
  const match = /T(\d{2}):(\d{2})/.exec(value);
  return match ? `数据更新 ${match[1]}:${match[2]}` : "更新时间未知";
}

function formatForecastTime(value: string | null | undefined, nightKey: string): string {
  if (!value) return "未选择";
  return formatHourWithDate(value, nightKey);
}

/**
 * A compact, read-only identity line for the forecast currently on the map.
 * It deliberately consumes store state instead of deriving score or validity
 * so hiding the advanced controls never hides the forecast's identity.
 */
export default function HomeContextStrip() {
  const { state } = useStore();
  const model = state.cloudState.model
    ? state.cloudState.model.toUpperCase()
    : "未知模型";
  const forecastTime = formatForecastTime(
    state.cloudState.activeForecastTime,
    state.selectedNight,
  );
  const updatedAt =
    state.forecast?.metadata?.fetchedAt ??
    state.forecast?.fetchedAt ??
    state.forecastAvailability.lastSuccessAt;

  return (
    <div
      className="home-context-strip"
      data-testid="home-context-strip"
      data-night-key={state.selectedNight}
      data-model={model}
      data-forecast-time={state.cloudState.activeForecastTime ?? ""}
      aria-label="当前预报上下文"
    >
      <span className="home-context-strip-night">
        {formatNightLabel(state.selectedNight, true)}
      </span>
      <span aria-hidden="true">·</span>
      <span>{model}</span>
      <span aria-hidden="true">·</span>
      <span>{forecastTime}</span>
      <span aria-hidden="true">·</span>
      <span>{formatUpdateTime(updatedAt)}</span>
    </div>
  );
}
