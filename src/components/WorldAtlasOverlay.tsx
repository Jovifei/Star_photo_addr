"use client";

import { ImageOverlay } from "react-leaflet";
import { useStore } from "@/lib/store";
import { WORLD_ATLAS_IMAGE } from "@/lib/constants";
import type { LatLngBoundsExpression } from "leaflet";

const WORLD_BOUNDS: LatLngBoundsExpression = [
  [-90, -180],
  [90, 180],
];

/** Global 2015 World-Atlas dark-sky reference layer (single image overlay). */
export default function WorldAtlasOverlay() {
  const { state } = useStore();
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
