"use client";

import { useEffect, useCallback } from "react";
import { useStore } from "@/lib/store";
import { formatNightLabel, formatHour, isInNight } from "@/lib/nighttime";
import { getValuesAtTime, averageLayer } from "@/lib/cloudGrid";

/** Number of night-time ticks (20:00 → 05:00 = 9 hours). */
const MAX_TIME_INDEX = 8;

/** Auto-play interval in milliseconds. */
const PLAY_INTERVAL_MS = 1500;

/**
 * Bottom-fixed cloud timeline control (Phase 2).
 *
 * Features:
 *   - Range slider 0-8 (9 ticks: 20:00 → 05:00).
 *   - Displays the current time as "8/12 周三 20:00".
 *   - Play/pause button that auto-advances the time index every 1.5 seconds.
 *   - Three layer proportion bars (high/mid/low) showing average values.
 *
 * The timeline is only visible when the cloud feature is enabled.
 */
export default function CloudTimeline() {
  const { state, setCloud } = useStore();
  const { cloudState, selectedNight, forecast } = state;

  // Get the night hours for time display.
  const nightHours = forecast
    ? forecast.hourly.filter((hour) => isInNight(hour.time, selectedNight))
    : [];
  const currentHour = nightHours[Math.min(cloudState.timeIndex, Math.max(0, nightHours.length - 1))];

  // Format the current time label.
  const timeLabel = currentHour
    ? `${formatNightLabel(selectedNight, true)} ${formatHour(currentHour.time)}`
    : formatNightLabel(selectedNight, true);

  // ----- Auto-play effect -----
  useEffect(() => {
    if (!cloudState.playing) return;

    const interval = setInterval(() => {
      setCloud({
        timeIndex: (cloudState.timeIndex + 1) % (MAX_TIME_INDEX + 1),
      });
    }, PLAY_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [cloudState.playing, cloudState.timeIndex, setCloud]);

  const togglePlay = useCallback(() => {
    setCloud({ playing: !cloudState.playing });
  }, [cloudState.playing, setCloud]);

  // Don't render if cloud is not enabled.
  if (!cloudState.enabled) return null;

  return (
    <div className="cloud-timeline">
      <div className="cloud-timeline-bar">
        <button
          type="button"
          className="cloud-timeline-play"
          onClick={togglePlay}
          aria-label={cloudState.playing ? "暂停" : "播放"}
        >
          {cloudState.playing ? "❚❚" : "▶"}
        </button>

        <div className="cloud-timeline-slider">
          <input
            type="range"
            min={0}
            max={MAX_TIME_INDEX}
            step={1}
            value={Math.min(cloudState.timeIndex, MAX_TIME_INDEX)}
            onChange={(event) =>
              setCloud({ timeIndex: Number(event.target.value) })
            }
          />
          <div className="cloud-timeline-labels">
            <span>
              {nightHours[0] ? formatHour(nightHours[0].time) : "20:00"}
            </span>
            <span className="cloud-timeline-current">{timeLabel}</span>
            <span>
              {nightHours[nightHours.length - 1]
                ? formatHour(nightHours[nightHours.length - 1].time)
                : "05:00"}
            </span>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {state.cloudGridLoading && (
        <div className="cloud-timeline-loading">正在采样云图数据…</div>
      )}

      {/* Three-layer proportion bars */}
      <div className="cloud-timeline-layers">
        <TimelineLayerBar
          label="高云"
          enabled={cloudState.highEnabled}
          colorVar="--green"
        />
        <TimelineLayerBar
          label="中云"
          enabled={cloudState.midEnabled}
          colorVar="--amber"
        />
        <TimelineLayerBar
          label="低云"
          enabled={cloudState.lowEnabled}
          colorVar="--green-soft"
        />
      </div>
    </div>
  );
}

/**
 * A proportion bar for the timeline showing the average cloud value.
 * Uses the store's cloudGrid data to compute the average at the current time.
 */
function TimelineLayerBar({
  label,
  enabled,
  colorVar,
}: {
  label: string;
  enabled: boolean;
  colorVar: string;
}) {
  const { state } = useStore();
  const { cloudGrid, cloudState, forecast, selectedNight } = state;

  let value = 0;

  if (cloudGrid) {
    const values = getValuesAtTime(cloudGrid, cloudState.timeIndex);
    const layerValues =
      label === "高云" ? values.high : label === "中云" ? values.mid : values.low;
    value = averageLayer(layerValues);
  } else if (forecast) {
    const nightHours = forecast.hourly.filter((hour) =>
      isInNight(hour.time, selectedNight),
    );
    const hour =
      nightHours[Math.min(cloudState.timeIndex, Math.max(0, nightHours.length - 1))];
    if (hour) {
      value = Math.round(
        label === "高云"
          ? (hour.cloudHigh ?? 0)
          : label === "中云"
            ? (hour.cloudMid ?? 0)
            : (hour.cloudLow ?? 0),
      );
    }
  }

  return (
    <div className={`cloud-timeline-layer${enabled ? "" : " disabled"}`}>
      <span className="cloud-timeline-layer-label">{label}</span>
      <div className="cloud-timeline-layer-track">
        <div
          className="cloud-timeline-layer-fill"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: `var(${colorVar})`,
            opacity: enabled ? 1 : 0.3,
          }}
        />
      </div>
      <span className="cloud-timeline-layer-value">{value}%</span>
    </div>
  );
}
