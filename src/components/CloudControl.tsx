"use client";

import { useStore } from "@/lib/store";
import { formatHour, isInNight } from "@/lib/nighttime";

const MODELS: { id: "icon" | "gfs" | "aifs"; label: string }[] = [
  { id: "icon", label: "ICON" },
  { id: "gfs", label: "GFS" },
  { id: "aifs", label: "AIFS" },
];

const VARIABLES: { id: "total" | "low" | "mid" | "high"; label: string }[] = [
  { id: "total", label: "总云" },
  { id: "low", label: "低云" },
  { id: "mid", label: "中云" },
  { id: "high", label: "高云" },
];

/** Future-cloud control (Phase 1 interactive UI + simplified indicator). */
export default function CloudControl() {
  const { state, setCloud } = useStore();
  const { cloudState, selectedLocation, selectedNight, forecast } = state;

  const ready = Boolean(selectedLocation && selectedNight);
  const nightHours = forecast
    ? forecast.hourly.filter((hour) => isInNight(hour.time, selectedNight))
    : [];
  const maxIndex = Math.max(0, nightHours.length - 1);
  const current = nightHours[Math.min(cloudState.timeIndex, maxIndex)];
  const variableValue =
    current == null
      ? null
      : cloudState.variable === "low"
        ? current.cloudLow
        : cloudState.variable === "mid"
          ? current.cloudMid
          : cloudState.variable === "high"
            ? current.cloudHigh
            : current.cloudCover;

  return (
    <div className="cloud-control compact">
      <div className="cloud-control-head">
        <b>未来云图</b>
        <button
          type="button"
          className="cloud-master-toggle"
          aria-pressed={cloudState.enabled}
          disabled={!ready}
          onClick={() => setCloud({ enabled: !cloudState.enabled })}
        >
          <span aria-hidden="true">☁</span>
          {cloudState.enabled ? "已开启" : "开启"}
        </button>
      </div>

      {!ready ? (
        <div className="cloud-hint">请先选择观测地点和日期以启用未来云图</div>
      ) : (
        <div className={`cloud-body${cloudState.enabled ? "" : " disabled"}`}>
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

          <div className="cloud-field">
            <label>云层类型</label>
            <div className="cloud-tabs">
              {VARIABLES.map((variable) => (
                <button
                  key={variable.id}
                  type="button"
                  className={cloudState.variable === variable.id ? "active" : ""}
                  onClick={() => setCloud({ variable: variable.id })}
                >
                  {variable.label}
                </button>
              ))}
            </div>
          </div>

          <div className="cloud-field cloud-slider">
            <label>预报时间</label>
            <input
              type="range"
              min={0}
              max={maxIndex}
              step={1}
              value={Math.min(cloudState.timeIndex, maxIndex)}
              disabled={!cloudState.enabled || nightHours.length === 0}
              onChange={(event) =>
                setCloud({ timeIndex: Number(event.target.value) })
              }
            />
            <div className="readout">
              <span>{current ? formatHour(current.time) : "—"}</span>
              <b>
                {variableValue == null
                  ? "—"
                  : `云量 ${Math.round(variableValue)}%`}
              </b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
