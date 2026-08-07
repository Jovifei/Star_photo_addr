"use client";

import { TileLayer } from "react-leaflet";
import { useStore } from "@/lib/store";
import { VIIRS_WEB_LAYER } from "@/data/viirsMeta";

/** China 2024 VIIRS (VNP46A4) Bortle-equivalent enhancement XYZ webp tiles. */
export default function ViirsTileLayer() {
  const { state } = useStore();
  if (!state.bortleEnabled) return null;
  return (
    <TileLayer
      url={VIIRS_WEB_LAYER.tiles}
      minZoom={VIIRS_WEB_LAYER.minzoom}
      maxZoom={VIIRS_WEB_LAYER.maxzoom}
      opacity={VIIRS_WEB_LAYER.opacity}
      zIndex={20}
      detectRetina={false}
    />
  );
}
