"use client";

import { hasDarkSkyLayer } from "@/lib/assets";
import { describeDarkSkyStatus } from "@/lib/darksky";
import { formatElevationMeters } from "@/lib/locationPresentation";
import { statusMeta } from "@/lib/scoring";
import type { DarkSkySample, Location, NightEvaluation } from "@/lib/types";
import ScoreRing from "@/components/ScoreRing";

function unavailableDarkSkyLabel(
  sample: DarkSkySample | null,
  installed: boolean,
): string {
  if (!installed || sample?.status === "layer-unavailable") return "未安装";
  if (sample?.status === "unsupported-region") return "无覆盖";
  if (sample?.status === "nodata") return "无有效像元";
  return "无数据";
}

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
  const darkSkyInstalled = hasDarkSkyLayer();
  const hasReading = sample != null && sample.status === "ok";
  const unavailableLabel = unavailableDarkSkyLabel(sample, darkSkyInstalled);
  const mpsasText =
    hasReading && sample.mpsas != null
      ? sample.mpsas.toFixed(2)
      : unavailableLabel;
  const snapshotBortle =
    location?.bortle != null && Number.isFinite(location.bortle)
      ? location.bortle
      : null;
  const bortleText =
    hasReading && sample.bortle != null
      ? `B${sample.bortle}`
      : snapshotBortle != null
        ? `B${snapshotBortle}`
        : unavailableLabel;
  const bortleName = hasReading
    ? (sample.bortleName ?? "")
    : snapshotBortle != null
      ? "地点快照"
      : darkSkyInstalled
        ? "本地栅格"
        : "需安装栅格";

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
          <div
            className="value"
            style={hasReading ? undefined : { fontSize: 15, color: "var(--muted)" }}
          >
            {mpsasText}
            {hasReading ? <small>mpsas</small> : <small>本地栅格</small>}
          </div>
        </div>
        <div className="metric">
          <div className="label">波特尔</div>
          <div
            className="value"
            style={
              hasReading || snapshotBortle != null
                ? undefined
                : { fontSize: 15, color: "var(--muted)" }
            }
          >
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

      {location && !darkSkyInstalled && (
        <p
          className="dark-sky-unavailable-note"
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--amber)",
            lineHeight: 1.55,
          }}
        >
          “未安装”表示当前构建没有本地 Bortle/SQM 数值栅格；VIIRS
          视觉夜光仍可用于空间参考，但不能冒充现场实测。
        </p>
      )}
      {darkSkyInstalled && sample != null && sample.status !== "ok" && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--amber)",
          }}
        >
          暗夜等级无数据：{describeDarkSkyStatus(sample.status)}
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
