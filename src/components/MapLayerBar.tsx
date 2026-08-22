"use client";

import { CloudSun, Star } from "lucide-react";
import { useStore } from "@/lib/store";
import type { CloudOverlayMode, MapViewMode } from "@/lib/types";

/**
 * The single authoritative layer switch (P1 interaction redesign): what data
 * the map paints with. Two entries only — cloud (with a forecast/live
 * sub-toggle, because both answer "what do the clouds look like", just in
 * different time domains) and the static light-pollution reference.
 */
function applyLayer(
  setCloud: (partial: Parameters<ReturnType<typeof useStore>["setCloud"]>[0]) => void,
  setMapViewMode: (mode: MapViewMode) => void,
  overlay: CloudOverlayMode,
) {
  setMapViewMode(overlay === "night-lights" ? "light-pollution" : overlay === "satellite-cloud" ? "satellite" : "combined");
  setCloud({ overlayMode: overlay, playing: false });
}

export default function MapLayerBar() {
  const { state, setCloud, setMapViewMode } = useStore();
  const overlay = state.cloudState.overlayMode ?? "forecast-cloud";
  const cloudActive = overlay === "satellite-cloud" || overlay === "forecast-cloud";

  return (
    <div className="map-layer-bar" role="group" aria-label="地图图层模式">
      <button
        type="button"
        data-layer="cloud"
        aria-pressed={cloudActive}
        className={cloudActive ? "active" : ""}
        onClick={() => {
          if (!cloudActive) applyLayer(setCloud, setMapViewMode, "forecast-cloud");
        }}
        title="云 · 预报（未来 72 小时）与卫星实况（过去 24 小时）"
      >
        <CloudSun size={14} aria-hidden="true" />
        <span>云图</span>
      </button>
      {cloudActive && (
        <span className="map-layer-sub" role="group" aria-label="云图时域">
          <button
            type="button"
            data-layer="forecast-cloud"
            aria-pressed={overlay === "forecast-cloud"}
            className={overlay === "forecast-cloud" ? "active" : ""}
            onClick={() => applyLayer(setCloud, setMapViewMode, "forecast-cloud")}
            title="数值模式 · 未来 72 小时外推"
          >
            预报
          </button>
          <button
            type="button"
            data-layer="satellite-cloud"
            aria-pressed={overlay === "satellite-cloud"}
            className={overlay === "satellite-cloud" ? "active" : ""}
            onClick={() => applyLayer(setCloud, setMapViewMode, "satellite-cloud")}
            title="Himawari 实况 · 过去 24 小时观测"
          >
            实况
          </button>
        </span>
      )}
      <button
        type="button"
        data-layer="night-lights"
        aria-pressed={overlay === "night-lights"}
        className={overlay === "night-lights" ? "active" : ""}
        onClick={() => applyLayer(setCloud, setMapViewMode, "night-lights")}
        title="VIIRS 2023 · 静态光污染参考"
      >
        <Star size={14} aria-hidden="true" />
        <span>光污染</span>
      </button>
    </div>
  );
}
