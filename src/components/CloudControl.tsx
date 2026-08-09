"use client";

import { useStore } from "@/lib/store";
import { Cloud } from "lucide-react";
import {
  averageLayer,
  getValuesAtTime,
} from "@/lib/cloudGrid";
import { isInNight } from "@/lib/nighttime";

const MODELS: { id: "icon" | "gfs" | "aifs"; label: string }[] = [
  { id: "icon", label: "ICON" },
  { id: "gfs", label: "GFS" },
  { id: "aifs", label: "AIFS" },
];

/**
 * Cloud control panel (Phase 2 — three-layer independent switches + bars).
 *
 * v2 changes:
 *   - Replaced the single `variable` select (total/low/mid/high) with three
 *     independent checkbox toggles for high/mid/low layers.
 *   - Each layer has a 0-100 proportion bar showing the average cloud value
 *     at the current timeIndex, updating in real-time as the timeline moves.
 *   - The time slider is now in the bottom CloudTimeline component; this
 *     control panel focuses on layer toggles and model selection.
 */
export default function CloudControl() {
  const { state, setCloud } = useStore();
  const { cloudState, selectedNight, forecast, cloudGrid } = state;

  // Compute average cloud values at the current time index.
  let highAvg = 0;
  let midAvg = 0;
  let lowAvg = 0;

  if (cloudGrid) {
    const values = getValuesAtTime(cloudGrid, cloudState.timeIndex);
    highAvg = averageLayer(values.high);
    midAvg = averageLayer(values.mid);
    lowAvg = averageLayer(values.low);
  } else if (forecast) {
    // Fallback: use single-point forecast values.
    const nightHours = forecast.hourly.filter((hour) =>
      isInNight(hour.time, selectedNight),
    );
    const hour =
      nightHours[Math.min(cloudState.timeIndex, Math.max(0, nightHours.length - 1))];
    if (hour) {
      highAvg = Math.round(hour.cloudHigh ?? 0);
      midAvg = Math.round(hour.cloudMid ?? 0);
      lowAvg = Math.round(hour.cloudLow ?? 0);
    }
  }

  return (
    <div className="cloud-control compact">
      <div className="cloud-control-head">
        <b>未来云图</b>
        <button
          type="button"
          className="cloud-master-toggle"
          aria-pressed={cloudState.enabled}
          onClick={() => setCloud({ enabled: !cloudState.enabled })}
        >
          <Cloud size={16} aria-hidden="true" />
          {cloudState.enabled ? "已开启" : "开启"}
        </button>
      </div>

      <div className={`cloud-body${cloudState.enabled ? "" : " disabled"}`}>
          {/* Model selector */}
          <div className="cloud-field">
            <label>预报模型</label>
            <div className="cloud-tabs">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={cloudState.model === model.id ? "active" : ""}
                  onClick={() => setCloud({ model: model.id })}
                >
                  {model.label}
                </button>
              ))}
            </div>
          </div>

          {/* Three-layer independent toggles + bars */}
          <div className="cloud-field cloud-layers">
            <label>云层控制</label>
            <CloudLayerBar
              label="高云"
              enabled={cloudState.highEnabled}
              value={highAvg}
              colorVar="--green"
              onToggle={() =>
                setCloud({ highEnabled: !cloudState.highEnabled })
              }
            />
            <CloudLayerBar
              label="中云"
              enabled={cloudState.midEnabled}
              value={midAvg}
              colorVar="--amber"
              onToggle={() =>
                setCloud({ midEnabled: !cloudState.midEnabled })
              }
            />
            <CloudLayerBar
              label="低云"
              enabled={cloudState.lowEnabled}
              value={lowAvg}
              colorVar="--cloud-low"
              onToggle={() =>
                setCloud({ lowEnabled: !cloudState.lowEnabled })
              }
            />
          </div>
        </div>
    </div>
  );
}

/**
 * A single cloud layer toggle + proportion bar.
 */
function CloudLayerBar({
  label,
  enabled,
  value,
  colorVar,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  value: number;
  colorVar: string;
  onToggle: () => void;
}) {
  return (
    <div className={`cloud-layer-bar${enabled ? " active" : ""}`}>
      <label className="cloud-layer-toggle">
        <input
          type="checkbox"
          checked={enabled}
          onChange={onToggle}
        />
        <span>{label}</span>
      </label>
      <div className="cloud-layer-track">
        <div
          className="cloud-layer-fill"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            background: `var(${colorVar})`,
          }}
        />
      </div>
      <span className="cloud-layer-value">{value}%</span>
    </div>
  );
}
