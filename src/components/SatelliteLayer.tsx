"use client";

import { useEffect, useRef, useState } from "react";
import { TileLayer } from "react-leaflet";
import { useStore } from "@/lib/store";
import {
  satelliteMaxNativeZoom,
  validSatelliteFrames,
} from "@/lib/satelliteFrames";
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
  const [frames, setFrames] = useState<SatelliteFrame[]>([]);
  const [frameMode, setFrameMode] = useState("");
  const [error, setError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const lastManualRevision = useRef(0);
  const requestSequence = useRef(0);
  const activeProductRef = useRef("");

  useEffect(() => {
    if (activeMode === "forecast-cloud" || usesUnifiedViirs) return;
    const timer = setInterval(
      () => setRefreshTick((value) => value + 1),
      REFRESH_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [activeMode, usesUnifiedViirs]);

  useEffect(() => {
    if (activeMode === "forecast-cloud" || usesUnifiedViirs) {
      requestSequence.current += 1;
      activeProductRef.current = "";
      setFrames([]);
      setSatelliteFrames([]);
      setFrameMode("");
      setError("");
      return;
    }

    const kind: SatelliteFrame["kind"] =
      activeMode === "satellite-cloud" ? "cloud" : "night-lights";
    const modeChanged = activeProductRef.current !== activeMode;
    activeProductRef.current = activeMode;
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;

    if (modeChanged) {
      // Do not let a cloud catalogue survive long enough to be rendered as a
      // night-light product (or vice versa) while the new request is pending.
      setFrames([]);
      setSatelliteFrames([]);
      setError("");
      setFrameMode(activeMode);
    }

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
        const data = await response.json().catch(() => null);
        if (!response.ok || !data) {
          throw new Error(data?.error ?? "卫星数据不可用");
        }
        return data;
      })
      .then((data) => {
        if (
          controller.signal.aborted ||
          requestSequence.current !== requestId ||
          activeProductRef.current !== activeMode
        ) {
          return;
        }
        const nextFrames = validSatelliteFrames(kind, data.frames);
        setFrameMode(activeMode);
        if (!nextFrames.length) {
          setFrames([]);
          setSatelliteFrames([]);
          setError(data.message ?? "最近没有可用卫星时次");
          return;
        }

        setFrames(nextFrames);
        setSatelliteFrames(nextFrames);
        const nextFrame = nextFrames[0];
        if (activeMode === "satellite-cloud" && nextFrame) {
          setCloud({ activeObservationTime: nextFrame.time });
        }
        setError(
          data.stale
            ? data.message ?? "正在使用最近一次成功的卫星目录"
            : "",
        );
      })
      .catch((requestError) => {
        if (
          requestError?.name === "AbortError" ||
          controller.signal.aborted ||
          requestSequence.current !== requestId ||
          activeProductRef.current !== activeMode
        ) {
          return;
        }
        setFrameMode(activeMode);
        if (modeChanged) {
          setFrames([]);
          setSatelliteFrames([]);
        }
        setError(describeSatelliteError(requestError));
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

  const expectedKind: SatelliteFrame["kind"] =
    activeMode === "satellite-cloud" ? "cloud" : "night-lights";
  const displayedFrame =
    activeMode === "satellite-cloud"
      ? frames.find(
          (item) =>
            item.kind === expectedKind &&
            item.time === state.cloudState.activeObservationTime,
        ) ?? frames.find((item) => item.kind === expectedKind) ?? null
      : frames.find((item) => item.kind === expectedKind) ?? null;

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
    .replaceAll("{TileMatrix}", "{z}")
    .replaceAll("{TileRow}", "{y}")
    .replaceAll("{TileCol}", "{x}");
  return (
    <>
      <TileLayer
        key={`${activeMode}:${displayedFrame.time}`}
        url={url}
        opacity={activeMode === "night-lights" ? 0.82 : 0.72}
        attribution={`&copy; NASA GIBS · ${displayedFrame.satellite} · ${displayedFrame.time}`}
        maxNativeZoom={satelliteMaxNativeZoom(displayedFrame.kind)}
        maxZoom={18}
        noWrap
        keepBuffer={4}
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
