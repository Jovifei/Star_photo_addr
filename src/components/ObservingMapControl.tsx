"use client";

import { SlidersHorizontal } from "lucide-react";
import { useStore } from "@/lib/store";
import { OBSERVING_SITE_COUNT } from "@/lib/observingSites";
import type { MapViewMode } from "@/lib/types";

const MODES: Array<{ id: MapViewMode; label: string; hint: string }> = [
  { id: "satellite", label: "卫星云图", hint: "Himawari · 过去 24 小时" },
  { id: "light-pollution", label: "光污染", hint: "VIIRS 2023 · 静态基准" },
  { id: "combined", label: "综合决策", hint: "光污染 + 未来云量" },
];

export default function ObservingMapControl() {
  const { state, setMapViewMode, setCloud, setRecommendationThreshold, setObservingBortleLimit, setRecommendedOnly } = useStore();
  const selectedMode = MODES.find((mode) => mode.id === state.mapViewMode) ?? MODES[0];

  function selectMode(mode: MapViewMode) {
    setMapViewMode(mode);
    setCloud({
      overlayMode: mode === "satellite" ? "satellite-cloud" : mode === "combined" ? "forecast-cloud" : "night-lights",
      playing: false,
    });
  }

  return (
    <section className="observing-map-control" aria-label="全国观星地点筛选与图层">
      <div className="observing-map-control-title">
        <span><SlidersHorizontal size={14} aria-hidden="true" />观星地点</span>
        <b>{state.observingBortleLimit === 3 ? 222 : OBSERVING_SITE_COUNT} 个点</b>
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
      <label className="observing-check-row">
        <input type="checkbox" checked={state.recommendedOnly} onChange={(event) => setRecommendedOnly(event.target.checked)} />
        <span>仅显示达到推荐门槛的地点</span>
      </label>
      <div className="observing-score-legend" aria-label="推荐评分颜色图例">
        <span><i style={{ background: "#63e6e2" }} />85–100 优先</span>
        <span><i style={{ background: "#76d69b" }} />70–84 推荐</span>
        <span><i style={{ background: "#e8bb72" }} />55–69 观望</span>
        <span><i style={{ background: "#e97979" }} />0–54 不推荐</span>
      </div>
      <small className="observing-map-control-note">常驻只显示地点名与评分点；云量、降水、风和评分构成请点击地点查看。</small>
    </section>
  );
}
