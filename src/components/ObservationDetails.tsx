"use client";

import { statusMeta } from "@/lib/scoring";
import type { DarkSkySample, Location, NightEvaluation } from "@/lib/types";
import ScoreRing from "@/components/ScoreRing";

/** Observation detail: dark-sky, weather window, moon, galaxy, confidence. */
export default function ObservationDetails({
  sample,
  evaluation,
  location,
}: {
  sample: DarkSkySample | null;
  evaluation: NightEvaluation | null;
  location: Location | null;
}) {
  const meta = statusMeta(evaluation?.status ?? "no");
  const mpsasText = sample?.mpsas == null ? "—" : sample.mpsas.toFixed(2);

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">
            {location ? location.source : "OBSERVATION"}
          </span>
          <h2 className="panel-location-name">
            {location?.name ?? "尚未选择地点"}
          </h2>
          <div className="panel-coords">
            {location
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} · ${location.elevation} m`
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
            <small>mpsas</small>
          </div>
        </div>
        <div className="metric">
          <div className="label">波特尔</div>
          <div className="value">
            {sample ? `B${sample.bortle}` : "—"}
            <small>{sample?.bortleName ?? ""}</small>
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

      {sample?.uncertain && (
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--amber)",
          }}
        >
          该位置暗夜采样不确定（中国以外或瓦片缺失），仅供参考。
        </p>
      )}

      <p className="panel-reason">
        {evaluation?.reason ??
          "选择地点后，将按当地时区计算 20:00–次日 05:00 的天气与天文窗口。"}
      </p>
    </div>
  );
}
