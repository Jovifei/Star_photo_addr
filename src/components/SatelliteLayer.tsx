"use client";

import { useEffect, useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { useStore } from "@/lib/store";
import type { SatelliteFrame } from "@/lib/types";

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function describeSatelliteError(error: unknown): string {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "卫星时次接口不可达，请确认服务已启动后刷新";
  }
  if (error instanceof Error && error.message) return error.message;
  return "卫星时次暂不可用";
}

export default function SatelliteLayer() {
  const { state, setSatelliteFrames, setCloud } = useStore();
  const activeMode = state.cloudState.overlayMode ?? "forecast-cloud";
  const usesUnifiedViirs =
    activeMode === "night-lights" &&
    state.mapViewMode === "light-pollution";
  const [frame, setFrame] = useState<SatelliteFrame | null>(null);
  const [frames, setFrames] = useState<SatelliteFrame[]>([]);
  const [frameMode, setFrameMode] = useState("");
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const lastManualRevision = useRef(0);

  useEffect(() => {
    if (activeMode === "forecast-cloud" || usesUnifiedViirs) return;
    const timer = setInterval(
      () => setRefreshTick((value) => value + 1),
      REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [activeMode, usesUnifiedViirs]);

  useEffect(() => {
    if (activeMode === "forecast-cloud" || usesUnifiedViirs) return;
    const kind =
      activeMode === "satellite-cloud" ? "cloud" : "night-lights";
    const manualRefresh =
      state.dataRefreshRevision > 0 &&
      state.dataRefreshRevision !== lastManualRevision.current;
    lastManualRevision.current = state.dataRefreshRevision;
    const params = new URLSearchParams({ kind });
    if (manualRefresh) params.set("refresh", "1");
    const controller = new AbortController();
    fetch(`/api/satellite/times?${params.toString()}`, {
      signal: controller.signal,
      cache: manualRefresh ? "no-store" : "default",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "卫星数据不可用");
        }
        return data;
      })
      .then((data) => {
        const nextFrames = Array.isArray(data.frames)
          ? (data.frames as SatelliteFrame[])
          : [];
        const nextFrame = nextFrames[0];
        if (nextFrames.length) {
          setFrames(nextFrames);
          setSatelliteFrames(nextFrames);
          setFrame(nextFrame ?? null);
          if (activeMode === "satellite-cloud" && nextFrame) {
            setCloud({ activeObservationTime: nextFrame.time });
          }
        }
        setFrameMode(activeMode);
        setError(
          nextFrame
            ? data.stale
              ? data.message ?? "正在使用最近一次成功的卫星目录"
              : ""
            : data.message ?? "最近没有可用卫星时次",
        );
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setFrameMode(activeMode);
          setError(describeSatelliteError(requestError));
        }
      });
    return () => controller.abort();
  }, [
    activeMode,
    refreshTick,
    setCloud,
    setSatelliteFrames,
    state.dataRefreshRevision,
    usesUnifiedViirs,
  ]);

  const displayedFrame =
    activeMode === "satellite-cloud"
      ? frames.find(
          (item) => item.time === state.cloudState.activeObservationTime,
        ) ?? frames[0] ?? null
      : frame;

  if (activeMode === "forecast-cloud" || usesUnifiedViirs) return null;
  if (frameMode !== activeMode || !displayedFrame) {
    return frameMode === activeMode && error ? (
      <div className="satellite-layer-error" role="status">
        {error}
      </div>
    ) : frameMode === activeMode ? (
      <div
        className="satellite-layer-error satellite-layer-loading"
        role="status"
      >
        正在刷新卫星观测…
      </div>
    ) : null;
  }

  const url = displayedFrame.tileTemplate
    .replaceAll("{Time}", displayedFrame.time)
    .replace("{TileMatrix}", "{z}")
    .replace("{TileRow}", "{y}")
    .replace("{TileCol}", "{x}");
  return (
    <>
      <TileLayer
        key={`${activeMode}:${displayedFrame.time}`}
        url={url}
        opacity={activeMode === "night-lights" ? 0.82 : 0.72}
        attribution={`&copy; NASA GIBS · ${displayedFrame.satellite} · ${displayedFrame.time}`}
        maxZoom={9}
      />
      <div className="satellite-frame-badge" role="status">
        {activeMode === "satellite-cloud"
          ? "卫星云观测"
          : "卫星夜光 · 2016 基准"}
        {" · "}
        {formatFrameTime(displayedFrame.time, activeMode)}
        {error ? " · 数据目录降级" : " · 已同步"}
      </div>
    </>
  );
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
