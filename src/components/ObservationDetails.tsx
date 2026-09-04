"use client";

import { estimateDarkSky } from "@/lib/darksky";
import { formatElevationMeters } from "@/lib/locationPresentation";
import { statusMeta } from "@/lib/scoring";
import type { DarkSkySample, Location, NightEvaluation } from "@/lib/types";
import ScoreRing from "@/components/ScoreRing";

/** Observation detail: dark-sky, weather window, moon, galaxy, confidence. */
export default function ObservationDetails({
  sample,
  evaluation,
  location,
  isCandidate = false,
  onAddCandidate,
}: {
  sample: DarkSkySample | null;
  evaluation: NightEvaluation | null;
  location: Location | null;
  isCandidate?: boolean;
  onAddCandidate?: () => void;
}) {
  const meta = statusMeta(evaluation?.status ?? "no");
  const hasReading = sample != null && sample.status === "ok";

  const estimate = location
    ? estimateDarkSky(
        location.latitude,
        location.longitude,
        location.elevation,
        location.bortle,
      )
    : null;

  const mpsasText =
    hasReading && sample.mpsas != null
      ? sample.mpsas.toFixed(2)
      : estimate
        ? `~${estimate.mpsas.toFixed(2)}`
        : "—";

  const mpsasUnit = hasReading
    ? "mpsas"
    : estimate
      ? "mpsas (估算)"
      : "待选择地点";

  const bortleText =
    hasReading && sample.bortle != null
      ? `B${sample.bortle}`
      : estimate
        ? `B${estimate.bortle}`
        : "—";

  const bortleName = hasReading
    ? (sample.bortleName ?? "")
    : estimate
      ? `${estimate.bortleName} · ${estimate.sourceLabel}`
      : "待选择地点";

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">
            {location ? location.source : "观测分析"}
          </span>
          <h2 className="panel-location-name">
            {location?.name ?? "尚未选择地点"}
          </h2>
          <div className="panel-coords">
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} · ${formatElevationMeters(location.elevation)}`
              : "点击地图或搜索以取样"}
          </div>
        </div>
        <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginTop: 14,
        }}
      >
        <ScoreRing value={evaluation?.score} label="星空分" />
        <div style={{ flex: 1 }}>
          <div className="window-callout" style={{ margin: 0 }}>
            <span className="icon">✦</span>
            <div>
              <span>最佳连续窗口</span>
              <strong>{evaluation?.windowLabel ?? "暂无数据"}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric">
          <div className="label">天顶亮度</div>
          <div className="value">
            {mpsasText}
            <small>{mpsasUnit}</small>
          </div>
        </div>
        <div className="metric">
          <div className="label">波特尔</div>
          <div className="value">
            {bortleText}
            {bortleName && <small>{bortleName}</small>}
          </div>
        </div>
        <div className="metric">
          <div className="label">月面照度</div>
          <div className="value">
            {Math.round((evaluation?.moonIllumination ?? 0) * 100)}
            <small>%</small>
          </div>
        </div>
        <div className="metric">
          <div className="label">暗夜时长</div>
          <div className="value">
            {evaluation?.darkHours ?? 0}
            <small>h</small>
          </div>
        </div>
        <div className="metric">
          <div className="label">银河最高</div>
          <div className="value">
            {evaluation?.galacticMax ?? 0}
            <small>°</small>
          </div>
        </div>
        <div className="metric">
          <div className="label">置信度</div>
          <div className="value" style={{ fontSize: 15 }}>
            {evaluation?.confidence.level ?? "—"}
          </div>
        </div>
      </div>

      {location && !hasReading && (
        <p
          className="dark-sky-unavailable-note"
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.55,
          }}
        >
          暗夜等级与天顶亮度为卫星夜光及地理模型估算值，供选点参考。
        </p>
      )}

      {location && onAddCandidate && (
        <button
          type="button"
          className="candidate-add-button"
          onClick={onAddCandidate}
          disabled={isCandidate}
        >
          {isCandidate ? "已加入观星计划" : "加入观星计划候选"}
        </button>
      )}
    </div>
  );
}
