"use client";

import { TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import {
  LIGHT_POLLUTION_ATTRIBUTION,
  LIGHT_POLLUTION_TILE_URL,
  lightPollutionTemplateError,
} from "@/lib/lightPollution";

const DEGRADE_AFTER_CONSECUTIVE_ERRORS = 4;

/**
 * VIIRS 2023 visual light-pollution reference layer.
 *
 * A single edge-tile/network error must not permanently remove the whole
 * raster. The layer remains mounted, reports a degraded state only after
 * repeated failures, and recovers automatically when a tile loads.
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
  const templateIssue = lightPollutionTemplateError(
    LIGHT_POLLUTION_TILE_URL,
  );

  useEffect(() => {
    const container = map.getContainer();
    container.dataset.observingViirsStatus = templateIssue
      ? "degraded"
      : "loading";
    container.dataset.observingViirsErrors = templateIssue
      ? "configuration"
      : "0";
    if (templateIssue) {
      container.dataset.observingViirsDetail = templateIssue;
    }
    return () => {
      delete container.dataset.observingViirsStatus;
      delete container.dataset.observingViirsErrors;
      delete container.dataset.observingViirsDetail;
    };
  }, [map, templateIssue]);

  if (templateIssue) return null;

  return (
    <TileLayer
      url={LIGHT_POLLUTION_TILE_URL}
      opacity={mode === "combined" ? 0.48 : 0.88}
      attribution={LIGHT_POLLUTION_ATTRIBUTION}
      maxZoom={18}
      tileSize={256}
      keepBuffer={4}
      // Do not set crossOrigin here. The raster is displayed as ordinary
      // <img> tiles and is never sampled by canvas; requiring CORS headers made
      // otherwise valid third-party/self-hosted WMTS tiles fail in browsers.
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
          delete container.dataset.observingViirsDetail;
        },
      }}
    />
  );
}
