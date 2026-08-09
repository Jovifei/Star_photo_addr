"use client";

import { useEffect, useRef, useState } from "react";
import { Rectangle, useMap, useMapEvents } from "react-leaflet";
import { useStore } from "@/lib/store";
import {
  forecastDaysForRange,
  generateGridBounds,
  fetchCloudGrid,
} from "@/lib/cloudGrid";
import { nightRangeKeys } from "@/lib/nighttime";
import CloudCanvasOverlay from "@/components/CloudCanvasOverlay";

/**
 * Three-layer cloud coverage overlay (Phase 2).
 *
 * When the cloud feature is enabled, this component:
 *   1. Samples the current map viewport as a 5×6 grid.
 *   2. Batch-fetches cloud forecasts for all grid points (reusing /api/forecast).
 *   3. Renders a continuous, null-safe regular-grid overlay via `CloudCanvasOverlay`.
 *   4. Draws a dashed rectangle marking the sampling boundary.
 *   5. Re-samples (debounced 500 ms) whenever the map moves or zooms.
 *
 * The timeIndex and layer toggles are read from the store's `cloudState`.
 */
export default function CloudLayer() {
  const { state, setCloudGrid, setCloudGridLoading } = useStore();
  const { cloudState, selectedNight, cloudGrid, cloudGridLoading } = state;
  const map = useMap();
  const [error, setError] = useState<string | null>(null);

  // Debounce timer ref for re-sampling on map move.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  // Signature of the currently loaded grid, so we don't re-fetch on every
  // unrelated render. Includes both the start night and the range count.
  const gridSigRef = useRef<string | null>(null);

  // ----- Grid sampling logic -----
  const performSampling = async () => {
    if (!map || !selectedNight || cloudState.overlayMode !== "forecast-cloud") return;

    const bounds = map.getBounds();
    const { samples, rows, cols } = generateGridBounds(bounds, 5, 6);
    const nights = nightRangeKeys(selectedNight, cloudState.range);

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setCloudGridLoading(true);
    // Do not keep painting a previous model/viewport while the new sample is
    // in flight; the active time and legend must describe the visible raster.
    setCloudGrid(null);
    setError(null);
    try {
      const data = await fetchCloudGrid(
        samples,
        nights,
        forecastDaysForRange(selectedNight, cloudState.range),
        cloudState.model,
        rows,
        cols,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      gridSigRef.current = `${selectedNight}|${cloudState.range}|${cloudState.model}`;
      setCloudGrid(data);
    } catch (err) {
      if (controller.signal.aborted) return;
      // Surface a small notice instead of silently leaving a blank map.
      setError(err instanceof Error ? err.message : "云图数据请求失败");
      setCloudGrid(null);
    } finally {
      if (!controller.signal.aborted) setCloudGridLoading(false);
    }
  };

  // ----- Trigger initial / re-sampling when cloud is enabled or range/night changes -----
  useEffect(() => {
    if (!cloudState.enabled || cloudState.overlayMode !== "forecast-cloud" || !map || !selectedNight) return;
    const sig = `${selectedNight}|${cloudState.range}|${cloudState.model}`;
    if (cloudGrid && gridSigRef.current === sig) return;
    void performSampling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudState.enabled, selectedNight, cloudState.range, cloudState.model, cloudState.overlayMode, map]);

  // ----- Map move/zoom handler with 500ms debounce -----
  useMapEvents({
    moveend() {
      if (!cloudState.enabled) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void performSampling();
      }, 500);
    },
    zoomend() {
      if (!cloudState.enabled) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void performSampling();
      }, 500);
    },
  });

  // ----- Cleanup -----
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestRef.current?.abort();
    };
  }, []);

  // Don't render anything if cloud is disabled.
  if (!cloudState.enabled || cloudState.overlayMode !== "forecast-cloud") return null;

  // Render the Canvas overlay + sampling boundary.
  const bounds = cloudGrid
    ? ([
        [cloudGrid.bounds.south, cloudGrid.bounds.west],
        [cloudGrid.bounds.north, cloudGrid.bounds.east],
      ] as [[number, number], [number, number]])
    : null;

  return (
    <>
      {cloudGrid && (
        <CloudCanvasOverlay
          gridData={cloudGrid}
          timeIndex={cloudState.timeIndex}
          activeForecastTime={cloudState.activeForecastTime}
          displayMode={cloudState.cloudDisplayMode}
          showPrecipitation={cloudState.precipitationEnabled}
          showWind={cloudState.windEnabled}
        />
      )}
      {bounds && (
        <Rectangle
          bounds={bounds}
          pathOptions={{
            color: "#91a4ab",
            weight: 1,
            dashArray: "6 4",
            fill: false,
            opacity: 0.5,
          }}
        />
      )}
      {cloudGridLoading && !cloudGrid && (
        // Loading indicator will be handled by the timeline/control UI.
        null
      )}
      {error && !cloudGrid && (
        <div className="cloud-overlay-error" role="status">
          云图加载失败：{error}
        </div>
      )}
    </>
  );
}
