"use client";

import { useEffect, useState } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { useStore } from "@/lib/store";
import type { SatelliteFrame } from "@/lib/types";

export default function SatelliteLayer() {
  const { state } = useStore();
  const mode = state.cloudState.overlayMode;
  const map = useMap();
  const [frame, setFrame] = useState<SatelliteFrame | null>(null);
  const [frameMode, setFrameMode] = useState<string>("");
  const [error, setError] = useState("");
  const activeMode = mode ?? "forecast";

  useEffect(() => {
    if (activeMode === "forecast") return;
    const kind = activeMode === "satellite-cloud" ? "cloud" : "night-lights";
    const center = map.getCenter();
    const controller = new AbortController();
    fetch(`/api/satellite/times?kind=${kind}&lat=${center.lat}&lng=${center.lng}`, { signal: controller.signal })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "卫星数据不可用"); return data; })
      .then((data) => { setFrame(data.frames?.[0] ?? null); setFrameMode(activeMode); setError(""); })
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); });
    return () => controller.abort();
  }, [activeMode, map]);

  if (activeMode === "forecast" || frameMode !== activeMode || !frame) return frameMode === activeMode && error ? <div className="satellite-layer-error" role="status">{error}</div> : null;
  const url = frame.tileTemplate.replaceAll("{Time}", frame.time).replace("{TileMatrix}", "{z}").replace("{TileRow}", "{y}").replace("{TileCol}", "{x}");
  return <TileLayer url={url} opacity={activeMode === "night-lights" ? 0.82 : 0.72} attribution={`&copy; NASA GIBS · ${frame.satellite} · ${frame.time}`} maxZoom={9} />;
}
