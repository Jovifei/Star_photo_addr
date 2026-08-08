"use client";

import { useEffect, useCallback, useMemo } from "react";
import { Pause, Play } from "lucide-react";
import { useStore } from "@/lib/store";
import {
  formatNightLabel,
  formatHour,
  formatHourWithDate,
} from "@/lib/nighttime";
import { NIGHT_START, NIGHT_END } from "@/lib/constants";
import { getValuesAtTime, averageLayer } from "@/lib/cloudGrid";

/** Hours per night: 20:00→次日05:00, inclusive = 10 ticks. */
const HOURS_PER_NIGHT = NIGHT_START + (24 - NIGHT_START) + (NIGHT_END + 1);
const RANGE_OPTIONS: Array<{ value: 1 | 5 | 7; label: string }> = [
  { value: 1, label: "今夜" },
  { value: 5, label: "5 天" },
  { value: 7, label: "7 天" },
];
const PLAY_INTERVAL_MS = 1500;

/**
 * Build the flat, chronological schedule of night-window hours across a range
 * of nights. Each entry is the local "YYYY-MM-DDTHH:00" the timeline indexes.
 */
function buildSchedule(nightKeys: string[]): Array<{ time: string; nightKey: string }> {
  const out: Array<{ time: string; nightKey: string }> = [];
  for (const nightKey of nightKeys) {
    for (let i = 0; i < HOURS_PER_NIGHT; i++) {
      const hour = (NIGHT_START + i) % 24;
      const dayOffset = hour <= NIGHT_END ? 1 : 0;
      const [y, m, d] = nightKey.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d + dayOffset));
      const dateStr = date.toISOString().slice(0, 10);
      out.push({
        time: `${dateStr}T${String(hour).padStart(2, "0")}:00`,
        nightKey,
      });
    }
  }
  return out;
}

function nightKeysFromStart(startKey: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const [y, m, d] = startKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + i));
    return date.toISOString().slice(0, 10);
  });
}

/**
 * Bottom-fixed cloud timeline. Supports a single night or a 5/7-night range:
 *   - segmented toggle (今夜 / 5 天 / 7 天)
 *   - continuous range slider with date tick marks
 *   - current time label with cross-midnight hint
 *   - play/pause auto-advance that loops within the selected range
 *   - three-layer proportion bars
 */
export default function CloudTimeline() {
  const { state, setCloud } = useStore();
  const { cloudState, selectedNight, cloudGrid } = state;

  const nightKeys = useMemo(
    () => nightKeysFromStart(selectedNight, cloudState.range),
    [selectedNight, cloudState.range],
  );
  const schedule = useMemo(() => buildSchedule(nightKeys), [nightKeys]);
  const maxIndex = schedule.length - 1;

  // Clamp the time index when the range shrinks.
  useEffect(() => {
    if (cloudState.timeIndex > maxIndex) {
      setCloud({ timeIndex: maxIndex });
    }
  }, [cloudState.timeIndex, maxIndex, setCloud]);

  const current = schedule[Math.min(cloudState.timeIndex, maxIndex)];
  const currentNightLabel = current
    ? formatNightLabel(current.nightKey, true)
    : formatNightLabel(selectedNight, true);
  const timeLabel = current
    ? `${currentNightLabel} ${formatHourWithDate(current.time, current.nightKey)}`
    : formatNightLabel(selectedNight, true);

  // ----- Auto-play -----
  useEffect(() => {
    if (!cloudState.playing) return;
    const interval = setInterval(() => {
      setCloud({
        timeIndex: (cloudState.timeIndex + 1) % (maxIndex + 1),
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cloudState.playing, cloudState.timeIndex, maxIndex, setCloud]);

  const togglePlay = useCallback(() => {
    setCloud({ playing: !cloudState.playing });
  }, [cloudState.playing, setCloud]);

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
          {cloudState.playing ? (
            <Pause size={16} aria-hidden="true" />
          ) : (
            <Play size={16} aria-hidden="true" />
          )}
        </button>

        <div className="cloud-timeline-range" role="group" aria-label="云图时间范围">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={cloudState.range === opt.value ? "active" : ""}
              aria-pressed={cloudState.range === opt.value}
              onClick={() =>
                setCloud({ range: opt.value, timeIndex: 0, playing: false })
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="cloud-timeline-slider">
          <input
            type="range"
            min={0}
            max={maxIndex}
            step={1}
            value={Math.min(cloudState.timeIndex, maxIndex)}
            aria-label="云图时间轴"
            list="cloud-timeline-ticks"
            onChange={(event) =>
              setCloud({ timeIndex: Number(event.target.value) })
            }
          />
          <datalist id="cloud-timeline-ticks">
            {nightKeys.map((key, i) => (
              <option key={key} value={i * HOURS_PER_NIGHT} label={formatNightLabel(key, true)} />
            ))}
          </datalist>
          <div className="cloud-timeline-labels">
            <span>{schedule[0] ? formatHour(schedule[0].time) : "20:00"}</span>
            <span className="cloud-timeline-current" title={timeLabel}>
              {timeLabel}
            </span>
            <span>
              {schedule[maxIndex] ? formatHour(schedule[maxIndex].time) : "05:00"}
            </span>
          </div>
        </div>
      </div>

      {state.cloudGridLoading && (
        <div className="cloud-timeline-loading">正在采样云图数据…</div>
      )}

      <div className="cloud-timeline-layers">
        <TimelineLayerBar label="高云" enabled={cloudState.highEnabled} colorVar="--green" />
        <TimelineLayerBar label="中云" enabled={cloudState.midEnabled} colorVar="--amber" />
        <TimelineLayerBar label="低云" enabled={cloudState.lowEnabled} colorVar="--cloud-low" />
      </div>
    </div>
  );
}

/** Proportion bar for one cloud layer at the current timeline index. */
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
  const { cloudGrid, cloudState } = state;

  let value = 0;
  if (cloudGrid) {
    const values = getValuesAtTime(cloudGrid, cloudState.timeIndex);
    const layerValues =
      label === "高云" ? values.high : label === "中云" ? values.mid : values.low;
    value = averageLayer(layerValues);
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
