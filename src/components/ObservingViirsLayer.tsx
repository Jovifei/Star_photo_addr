"use client";

import { TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  LIGHT_POLLUTION_ATTRIBUTION,
  LIGHT_POLLUTION_TILE_URL,
} from "@/lib/lightPollution";

const DEGRADE_AFTER_CONSECUTIVE_ERRORS = 4;

/**
 * VIIRS 2023 visual light-pollution reference layer.
 *
 * A single edge-tile/network error must not permanently remove the whole
 * raster. The layer now remains mounted, reports a degraded state only after
 * repeated consecutive failures, and recovers automatically as soon as a tile
 * loads successfully.
 */
export default function ObservingViirsLayer() {
  const { state } = useStore();
  if (state.mapViewMode === "satellite") return null;
  return <ViirsTileLayer key={state.mapViewMode} mode={state.mapViewMode} />;
}

function ViirsTileLayer({
  mode,
}: {
  mode: "light-pollution" | "combined";
}) {
  const map = useMap();
  const consecutiveErrors = useRef(0);
  const loadedTiles = useRef(0);

  useEffect(() => {
    const container = map.getContainer();
    container.dataset.observingViirsStatus = "loading";
    container.dataset.observingViirsErrors = "0";
    return () => {
      delete container.dataset.observingViirsStatus;
      delete container.dataset.observingViirsErrors;
    };
  }, [map]);

  return (
    <TileLayer
      url={LIGHT_POLLUTION_TILE_URL}
      opacity={mode === "combined" ? 0.48 : 0.88}
      attribution={LIGHT_POLLUTION_ATTRIBUTION}
      maxZoom={18}
      tileSize={256}
      crossOrigin="anonymous"
      eventHandlers={{
        tileloadstart: () => {
          if (!loadedTiles.current) {
            map.getContainer().dataset.observingViirsStatus = "loading";
          }
        },
        tileerror: () => {
          consecutiveErrors.current += 1;
          const container = map.getContainer();
          container.dataset.observingViirsErrors = String(
            consecutiveErrors.current,
          );
          if (
            consecutiveErrors.current >= DEGRADE_AFTER_CONSECUTIVE_ERRORS
          ) {
            container.dataset.observingViirsStatus = "degraded";
          }
        },
        tileload: () => {
          loadedTiles.current += 1;
          consecutiveErrors.current = 0;
          const container = map.getContainer();
          container.dataset.observingViirsStatus = "available";
          container.dataset.observingViirsErrors = "0";
        },
      }}
    />
  );
}
