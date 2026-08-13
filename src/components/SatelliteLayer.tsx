"use client";

import { useEffect, useState } from "react";
import { TileLayer, useMap, useMapEvents } from "react-leaflet";
import { useStore } from "@/lib/store";
import type { SatelliteFrame } from "@/lib/types";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export default function SatelliteLayer() {
  const { state, setSatelliteFrames, setCloud } = useStore();
  const mode = state.cloudState.overlayMode;
  const map = useMap();
  const [frame, setFrame] = useState<SatelliteFrame | null>(null);
  const [frames, setFrames] = useState<SatelliteFrame[]>([]);
  const [frameMode, setFrameMode] = useState<string>("");
  const [error, setError] = useState("");
  const [viewportKey, setViewportKey] = useState(() => viewportSignature(map));
  const [refreshTick, setRefreshTick] = useState(0);
  const activeMode = mode ?? "forecast-cloud";
  const usesUnifiedViirs = activeMode === "night-lights" && state.mapViewMode === "light-pollution";

  useMapEvents({
    moveend: () => setViewportKey(viewportSignature(map)),
    zoomend: () => setViewportKey(viewportSignature(map)),
  });

  useEffect(() => {
    if (activeMode === "forecast-cloud" || usesUnifiedViirs) return;
    const timer = setInterval(() => setRefreshTick((value) => value + 1), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [activeMode, usesUnifiedViirs]);

  useEffect(() => {
    if (activeMode === "forecast-cloud" || usesUnifiedViirs) return;
    const kind = activeMode === "satellite-cloud" ? "cloud" : "night-lights";
    const center = map.getCenter();
    const controller = new AbortController();
    fetch(`/api/satellite/times?kind=${kind}&lat=${center.lat}&lng=${center.lng}&refresh=${refreshTick}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "卫星数据不可用"); return data; })
      .then((data) => {
        const nextFrames = Array.isArray(data.frames) ? data.frames as SatelliteFrame[] : [];
        const nextFrame = nextFrames[0];
        setFrames(nextFrames);
        setSatelliteFrames(nextFrames);
        setFrame(nextFrame ?? null);
        if (activeMode === "satellite-cloud" && nextFrame) {
          setCloud({ activeObservationTime: nextFrame.time });
        }
        setFrameMode(activeMode);
        setError(nextFrame ? "" : (data.message ?? "最近 7 天没有可用卫星时次"));
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setFrameMode(activeMode);
          setError(requestError.message);
        }
      });
    return () => controller.abort();
  }, [activeMode, map, refreshTick, setCloud, setSatelliteFrames, usesUnifiedViirs, viewportKey]);

  const displayedFrame = activeMode === "satellite-cloud"
    ? frames.find((item) => item.time === state.cloudState.activeObservationTime) ?? frames[0] ?? null
    : frame;

  if (activeMode === "forecast-cloud" || usesUnifiedViirs) return null;
  if (frameMode !== activeMode || !displayedFrame) {
    return frameMode === activeMode && error
      ? <div className="satellite-layer-error" role="status">{error}</div>
      : frameMode === activeMode
        ? <div className="satellite-layer-error satellite-layer-loading" role="status">正在刷新卫星观测…</div>
        : null;
  }
  const url = displayedFrame.tileTemplate.replaceAll("{Time}", displayedFrame.time).replace("{TileMatrix}", "{z}").replace("{TileRow}", "{y}").replace("{TileCol}", "{x}");
  return (
    <>
      <TileLayer key={`${activeMode}:${displayedFrame.time}:${viewportKey}`} url={url} opacity={activeMode === "night-lights" ? 0.82 : 0.72} attribution={`&copy; NASA GIBS · ${displayedFrame.satellite} · ${displayedFrame.time}`} maxZoom={9} />
      <div className="satellite-frame-badge" role="status">
        {activeMode === "satellite-cloud" ? "卫星云观测" : "卫星夜光 · 2016 基准"} · {formatFrameTime(displayedFrame.time, activeMode)} · 已刷新
      </div>
    </>
  );
}

function viewportSignature(map: ReturnType<typeof useMap>): string {
  const center = map.getCenter();
  return `${center.lat.toFixed(3)}:${center.lng.toFixed(3)}:${map.getZoom()}`;
}

function formatFrameTime(time: string, mode: string): string {
  if (mode === "night-lights" && time.length === 10) return time;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(time));
}
