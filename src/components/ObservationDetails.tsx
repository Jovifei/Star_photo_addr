"use client";

import { useEffect, useMemo, useState } from "react";
import { describeDarkSkyStatus, sampleBortle } from "@/lib/darksky";
import { formatElevationMeters } from "@/lib/locationPresentation";
import { statusMeta } from "@/lib/scoring";
import type { DarkSkySample, Location, NightEvaluation } from "@/lib/types";
import ScoreRing from "@/components/ScoreRing";

function sampleMatchesLocation(
  sample: DarkSkySample | null,
  location: Location,
): boolean {
  return Boolean(
    sample &&
      Math.abs(sample.latitude - location.latitude) < 1e-6 &&
      Math.abs(sample.longitude - location.longitude) < 1e-6,
  );
}

interface FetchedDarkSkySample {
  locationKey: string;
  sample: DarkSkySample;
}

/** Observation detail: dark-sky, weather window, moon, galaxy, confidence. */
export default function ObservationDetails({
  sample,
  evaluation,
  location,
  isCandidate = false,
  onAddCandidate,
  onRemoveCandidate,
}: {
  sample: DarkSkySample | null;
  evaluation: NightEvaluation | null;
  location: Location | null;
  isCandidate?: boolean;
  onAddCandidate?: () => void;
  onRemoveCandidate?: () => void;
}) {
  const meta = statusMeta(evaluation?.status ?? "no");
  const [fetchedSample, setFetchedSample] =
    useState<FetchedDarkSkySample | null>(null);
  const locationKey = location
    ? `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`
    : "";
  const storeSampleMatches = Boolean(
    location && sampleMatchesLocation(sample, location),
  );

  // A curated site selected through selectLocation() does not necessarily pass
  // through store.sampleAt(). Sample the exact coordinate here so installed
  // licensed rasters remain usable without falling back to catalog Bortle.
  // The async result is tagged with locationKey; old-location results therefore
  // become inert immediately when the selected coordinate changes. The effect
  // only updates state from the external async callback, never synchronously.
  useEffect(() => {
    if (!location || storeSampleMatches) return;
    let cancelled = false;
    const key = locationKey;
    void sampleBortle(location.latitude, location.longitude).then((next) => {
      if (!cancelled) {
        setFetchedSample({ locationKey: key, sample: next });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    location,
    locationKey,
    storeSampleMatches,
  ]);

  const resolvedSample = useMemo(() => {
    if (!location) return null;
    if (storeSampleMatches) return sample;
    return fetchedSample?.locationKey === locationKey ? fetchedSample.sample : null;
  }, [fetchedSample, location, locationKey, sample, storeSampleMatches]);

  const hasReading =
    resolvedSample?.status === "ok" &&
    resolvedSample.mpsas != null &&
    resolvedSample.bortle != null;

  const mpsasText = hasReading ? resolvedSample.mpsas!.toFixed(2) : "—";
  const mpsasUnit = hasReading
    ? "mpsas"
    : location
      ? "无可信数值"
      : "待选择地点";

  const bortleText = hasReading ? `B${resolvedSample.bortle}` : "—";
  const bortleName = hasReading
    ? (resolvedSample.bortleName ?? "")
    : location
      ? "无可信栅格读数"
      : "待选择地点";

  const darkSkyStatusNote =
    location && !hasReading
      ? resolvedSample
        ? `${describeDarkSkyStatus(resolvedSample.status)} 不会根据坐标、海拔或点位目录推算 Bortle/SQM。`
        : "正在读取当前坐标的暗夜数值；没有可信栅格时不会根据坐标、海拔或点位目录推算 Bortle/SQM。"
      : null;

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

      {darkSkyStatusNote && (
        <p
          className="dark-sky-unavailable-note"
          style={{
            marginTop: 10,
            fontSize: 11,
            color: "var(--muted)",
            lineHeight: 1.55,
          }}
        >
          {darkSkyStatusNote}
        </p>
      )}

      {location && (onAddCandidate || onRemoveCandidate) && (
        <button
          type="button"
          className={`candidate-add-button ${isCandidate ? "candidate-add-button--active" : ""}`}
          onClick={() => {
            if (isCandidate) {
              onRemoveCandidate?.();
            } else {
              onAddCandidate?.();
            }
          }}
        >
          {isCandidate ? "✓ 已在候选对比 (点击移出)" : "+ 加入候选对比 (参与7天排行)"}
        </button>
      )}
    </div>
  );
}
