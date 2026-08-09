"use client";

import { ImageOverlay } from "react-leaflet";
import { useStore } from "@/lib/store";
import { hasAsset } from "@/lib/assets";
import { WORLD_ATLAS_IMAGE } from "@/lib/constants";
import type { LatLngBoundsExpression } from "leaflet";

const WORLD_BOUNDS: LatLngBoundsExpression = [
  [-90, -180],
  [90, 180],
];

/**
 * Global 2015 World-Atlas dark-sky reference layer (single image overlay).
 *
 * The Falchi et al. raster has no confirmed redistribution licence for this
 * project, so it is not shipped. Without the file the overlay would request a
 * missing image on every mount; the layer is therefore gated off entirely.
 */
export default function WorldAtlasOverlay() {
  const { state } = useStore();
  if (!hasAsset("worldAtlas")) return null;
  if (!state.bortleEnabled) return null;
  return (
    <ImageOverlay
      url={WORLD_ATLAS_IMAGE}
      bounds={WORLD_BOUNDS}
      opacity={0.45}
      zIndex={10}
      interactive={false}
    />
  );
}
