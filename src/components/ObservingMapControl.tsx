"use client";

import { SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  OBSERVING_SITES,
  OBSERVING_SITE_COUNT,
  snapshotScoreAtTime,
} from "@/lib/observingSites";
import {
  forecastTimeWindow,
  formatNightLabel,
  scoreDateForForecastTime,
} from "@/lib/nighttime";
import type { MapViewMode, ObservationSnapshot, RecommendationBand } from "@/lib/types";

const MODES: Array<{ id: MapViewMode; label: string; hint: string }> = [
  { id: "satellite", label: "卫星云图", hint: "Himawari · 过去 24 小时" },
  { id: "light-pollution", label: "光污染", hint: "VIIRS 2023 · 静态基准" },
  { id: "combined", label: "综合决策", hint: "光污染 + 未来云量" },
];

const BAND_FILTERS: Array<{ id: Exclude<RecommendationBand, "unknown">; label: string; range: string; color: string }> = [
  { id: "priority", label: "优先", range: "85–100", color: "#63e6e2" },
  { id: "recommended", label: "推荐", range: "70–84", color: "#76d69b" },
  { id: "watch", label: "观望", range: "55–69", color: "#e8bb72" },
  { id: "not-recommended", label: "不推荐", range: "0–54", color: "#e97979" },
];

export default function ObservingMapControl() {
  const { state, setMapViewMode, setCloud, setRecommendationThreshold, setObservingBortleLimit, setRecommendedOnly, setRecommendationBands } = useStore();
  const selectedMode = MODES.find((mode) => mode.id === state.mapViewMode) ?? MODES[0];
  const [scoreWindowStart] = useState(state.cloudState.activeForecastTime ?? "");
  const scoreTimes = useMemo(() => forecastTimeWindow(scoreWindowStart, 72), [scoreWindowStart]);
  const [snapshot, setSnapshot] = useState<ObservationSnapshot | null>(null);
  const [snapshotErrorTime, setSnapshotErrorTime] = useState<string | null>(null);
  const snapshotRequestId = useRef(0);
  const activeScoreTime = scoreTimes.includes(state.cloudState.activeForecastTime ?? "")
    ? state.cloudState.activeForecastTime!
    : scoreTimes[0] ?? "";
  const snapshotRequestKey = `${activeScoreTime}|${state.cloudState.model}|${state.selectedNight}`;

  useEffect(() => {
    if (!activeScoreTime || activeScoreTime === state.cloudState.activeForecastTime) return;
    setCloud({ activeForecastTime: activeScoreTime, playing: false });
  }, [activeScoreTime, setCloud, state.cloudState.activeForecastTime]);

  useEffect(() => {
    if (!activeScoreTime) return;
    const requestId = snapshotRequestId.current + 1;
    snapshotRequestId.current = requestId;
    const controller = new AbortController();
    const params = new URLSearchParams({
      date: scoreDateForForecastTime(activeScoreTime, state.selectedNight),
      days: "1",
      model: state.cloudState.model,
      time: activeScoreTime,
    });
    fetch(`/api/observing/snapshot?${params.toString()}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "观星评分暂时不可用");
        return payload as ObservationSnapshot;
      })
      .then((payload) => {
        if (controller.signal.aborted || requestId !== snapshotRequestId.current) return;
        setSnapshot(payload);
        setSnapshotErrorTime(null);
      })
      .catch((error) => {
        if (error?.name !== "AbortError" && !controller.signal.aborted && requestId === snapshotRequestId.current) {
          setSnapshotErrorTime(snapshotRequestKey);
        }
      });
    return () => controller.abort();
  }, [activeScoreTime, snapshotRequestKey, state.cloudState.model, state.selectedNight]);

  // A response for the previous slider position must not be used while the
  // new hourly snapshot is in flight.  The API cache key includes focusTime,
  // so this check keeps the numbers and marker colours on the same ISO hour.
  const activeSnapshot = snapshot?.focusTime === activeScoreTime && snapshot.model === state.cloudState.model
    ? snapshot
    : null;
  const snapshotStatus = snapshotErrorTime === snapshotRequestKey
    ? "degraded"
    : activeSnapshot
      ? activeSnapshot.stale ? "degraded" : "available"
      : "loading";

  const baseSites = useMemo(
    () => OBSERVING_SITES.filter((site) => site.bortle <= state.observingBortleLimit),
    [state.observingBortleLimit],
  );
  const scoreByBand = useMemo(() => {
    const counts: Record<Exclude<RecommendationBand, "unknown">, number> = {
      priority: 0,
      recommended: 0,
      watch: 0,
      "not-recommended": 0,
    };
    for (const site of baseSites) {
      const score = snapshotScoreAtTime(activeSnapshot, site.id);
      if (score?.band && score.band !== "unknown") counts[score.band] += 1;
    }
    return counts;
  }, [activeSnapshot, baseSites]);
  const thresholdCount = useMemo(
    () => baseSites.filter((site) => {
      const score = snapshotScoreAtTime(activeSnapshot, site.id)?.score;
      return score != null && score >= state.recommendationThreshold;
    }).length,
    [activeSnapshot, baseSites, state.recommendationThreshold],
  );
  const visibleCount = useMemo(
    () => baseSites.filter((site) => {
      const score = snapshotScoreAtTime(activeSnapshot, site.id);
      if (state.recommendedOnly && (score?.score == null || score.score < state.recommendationThreshold)) return false;
      if (score?.band && score.band !== "unknown" && !state.visibleRecommendationBands.includes(score.band)) return false;
      return true;
    }).length,
    [activeSnapshot, baseSites, state.recommendedOnly, state.recommendationThreshold, state.visibleRecommendationBands],
  );

  function describeScoreTime(time: string): string {
    if (!time) return "等待预报时间";
    const date = time.slice(0, 10);
    const startDate = scoreWindowStart.slice(0, 10);
    const dayOffset = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000);
    const dayLabel = dayOffset === 0 ? "现在" : dayOffset === 1 ? "明天" : dayOffset === 2 ? "后天" : `第 ${dayOffset + 1} 天`;
    return `${dayLabel} · ${formatNightLabel(date, true)} ${time.slice(11, 16)}`;
  }

  function setScoreTime(index: number) {
    const time = scoreTimes[Math.min(Math.max(index, 0), Math.max(0, scoreTimes.length - 1))];
    if (time) setCloud({ activeForecastTime: time, playing: false });
  }

  function selectMode(mode: MapViewMode) {
    setMapViewMode(mode);
    setCloud({
      overlayMode: mode === "satellite" ? "satellite-cloud" : mode === "combined" ? "forecast-cloud" : "night-lights",
      playing: false,
    });
  }

  return (
    <section
      className="observing-map-control"
      aria-label="全国观星地点筛选与图层"
      data-score-time={activeScoreTime}
      data-score-status={snapshotStatus}
      data-score-threshold-count={activeSnapshot ? thresholdCount : ""}
    >
      <div className="observing-map-control-title">
        <span><SlidersHorizontal size={14} aria-hidden="true" />观星地点</span>
        <b>{activeSnapshot ? visibleCount : "—"} / {state.observingBortleLimit === 3 ? 222 : OBSERVING_SITE_COUNT} 个点</b>
      </div>
      <div className="observing-mode-tabs" role="tablist" aria-label="地图模式">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={state.mapViewMode === mode.id}
            className={state.mapViewMode === mode.id ? "active" : ""}
            onClick={() => selectMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <small>{selectedMode.hint}</small>
      <label className="observing-filter-row">
        <span>Bortle ≤ {state.observingBortleLimit}</span>
        <select value={state.observingBortleLimit} onChange={(event) => setObservingBortleLimit(Number(event.target.value) === 4 ? 4 : 3)} aria-label="Bortle 地点范围">
          <option value="3">B1–B3 · 222 个</option>
          <option value="4">B1–B4 · 242 个</option>
        </select>
      </label>
      <label className="observing-threshold-row">
        <span>推荐门槛 <b>{state.recommendationThreshold}</b></span>
        <input type="range" min="50" max="90" step="5" value={state.recommendationThreshold} onChange={(event) => setRecommendationThreshold(Number(event.target.value))} aria-label="推荐分数门槛" />
      </label>
      <div className="observing-score-window" aria-label="观星评分时间窗口">
        <div className="observing-score-window-title">
          <span>评分时次</span>
          <strong>{describeScoreTime(activeScoreTime)}</strong>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(0, scoreTimes.length - 1)}
          value={Math.max(0, scoreTimes.indexOf(activeScoreTime))}
          onChange={(event) => setScoreTime(Number(event.target.value))}
          aria-label="观星评分时间滑窗"
          aria-valuetext={describeScoreTime(activeScoreTime)}
          disabled={!scoreTimes.length}
        />
        <div className="observing-score-window-ticks" aria-hidden="true">
          <span>现在</span><span>明天</span><span>后天</span><span>+72h</span>
        </div>
        <small>{snapshotStatus === "loading" ? "正在按此时次刷新地点评分…" : snapshotStatus === "degraded" ? "当前时次评分暂不可用，地图不沿用旧时次颜色" : "分数、颜色和地点数量均按此时次的数值预报计算；卫星图层仍是独立观测"}</small>
      </div>
      <div className="observing-score-counts" aria-label="当前时次评分数量">
        <span>当前显示 <b>{activeSnapshot ? visibleCount : "—"}</b></span>
        <span>≥{state.recommendationThreshold}分 <b>{activeSnapshot ? thresholdCount : "—"}</b></span>
      </div>
      <label className="observing-check-row">
        <input type="checkbox" checked={state.recommendedOnly} onChange={(event) => setRecommendedOnly(event.target.checked)} />
        <span>仅显示达到推荐门槛的地点</span>
      </label>
      <div className="observing-score-legend" aria-label="推荐评分颜色筛选">
        {BAND_FILTERS.map((filter) => (
          <label className="observing-band-option" key={filter.id}>
            <input
              type="checkbox"
              checked={state.visibleRecommendationBands.includes(filter.id)}
              onChange={() => {
                const next = state.visibleRecommendationBands.includes(filter.id)
                  ? state.visibleRecommendationBands.filter((band) => band !== filter.id)
                  : [...state.visibleRecommendationBands, filter.id];
                setRecommendationBands(next);
              }}
              aria-label={`显示${filter.label}地点`}
            />
            <i style={{ background: filter.color }} />
            <span><b>{filter.range}</b> {filter.label} <em>{activeSnapshot ? scoreByBand[filter.id] : "—"}</em></span>
          </label>
        ))}
      </div>
      <small className="observing-map-control-note">勾选评分档位控制地图上的点；地图不常驻显示天气详情，点击地点查看完整数据。</small>
    </section>
  );
}
