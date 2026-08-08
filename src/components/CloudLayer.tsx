"use client";

import { useEffect, useRef } from "react";
import { Rectangle, useMap, useMapEvents } from "react-leaflet";
import { useStore } from "@/lib/store";
import {
  forecastDaysForNight,
  generateGridBounds,
  fetchCloudGrid,
} from "@/lib/cloudGrid";
import CloudCanvasOverlay from "@/components/CloudCanvasOverlay";

/**
 * Three-layer cloud coverage overlay (Phase 2).
 *
 * When the cloud feature is enabled, this component:
 *   1. Samples the current map viewport as a 5×6 grid.
 *   2. Batch-fetches cloud forecasts for all grid points (reusing /api/forecast).
 *   3. Renders a Canvas IDW overlay via `CloudCanvasOverlay`.
 *   4. Draws a dashed rectangle marking the sampling boundary.
 *   5. Re-samples (debounced 500 ms) whenever the map moves or zooms.
 *
 * The timeIndex and layer toggles are read from the store's `cloudState`.
 */
export default function CloudLayer() {
  const { state, setCloudGrid, setCloudGridLoading } = useStore();
  const { cloudState, selectedNight, cloudGrid, cloudGridLoading } = state;
  const map = useMap();

  // Debounce timer ref for re-sampling on map move.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the night key used for the current grid data to avoid stale data.
  const gridNightRef = useRef<string | null>(null);

  // ----- Grid sampling logic -----
  const performSampling = async () => {
    if (!map || !selectedNight) return;

    const bounds = map.getBounds();
    const { samples } = generateGridBounds(bounds, 5, 6);

    setCloudGridLoading(true);
    try {
      const data = await fetchCloudGrid(
        samples,
        selectedNight,
        forecastDaysForNight(selectedNight),
      );
      gridNightRef.current = selectedNight;
      setCloudGrid(data);
    } catch {
      // Silently fail — the overlay just won't render.
      setCloudGrid(null);
    } finally {
      setCloudGridLoading(false);
    }
  };

  // ----- Trigger initial sampling when cloud is enabled -----
  useEffect(() => {
    if (!cloudState.enabled || !map || !selectedNight) return;
    // Only sample if we don't have data yet, or the night changed.
    if (cloudGrid && gridNightRef.current === selectedNight) return;
    void performSampling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudState.enabled, selectedNight, map]);

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
    };
  }, []);

  // Don't render anything if cloud is disabled.
  if (!cloudState.enabled) return null;

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
          highEnabled={cloudState.highEnabled}
          midEnabled={cloudState.midEnabled}
          lowEnabled={cloudState.lowEnabled}
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
    </>
  );
}
