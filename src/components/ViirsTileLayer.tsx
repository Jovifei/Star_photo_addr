"use client";

import { TileLayer } from "react-leaflet";
import { useStore } from "@/lib/store";
import { hasAsset } from "@/lib/assets";
import { VIIRS_WEB_LAYER } from "@/data/viirsMeta";

/**
 * China 2024 VIIRS (VNP46A4) Bortle-equivalent enhancement XYZ webp tiles.
 *
 * The tile pyramid is not distributed with this repository. Mounting the layer
 * without it makes Leaflet request a full screen of tiles on every pan/zoom,
 * each one a 404 — so the layer is not mounted at all unless the bundle is
 * installed. See docs/PUBLIC_ASSETS_AUDIT.md.
 */
export default function ViirsTileLayer() {
  const { state } = useStore();
  if (!hasAsset("viirsTiles")) return null;
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
