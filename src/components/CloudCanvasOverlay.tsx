"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { CloudGridData } from "@/lib/types";
import {
  idwInterpolate,
  getValuesAtTime,
  cloudLayerValueToColor,
} from "@/lib/cloudGrid";

interface CloudCanvasOverlayProps {
  /** Grid sampling data (null = no overlay). */
  gridData: CloudGridData | null;
  /** Current time index (0-9). */
  timeIndex: number;
  /** Layer visibility toggles. */
  highEnabled: boolean;
  midEnabled: boolean;
  lowEnabled: boolean;
}

/**
 * Leaflet canvas overlay for three-layer cloud IDW rendering.
 *
 * This component does NOT use a Leaflet L.Layer extension. Instead it creates
 * an absolutely-positioned `<canvas>` element on top of the map container and
 * redraws on every map move/zoom and on every prop change.
 *
 * Rendering pipeline:
 *   1. Convert all sample points to pixel coordinates via `map.latLngToContainerPoint`.
 *   2. For each enabled layer (high/mid/low), extract the cloud values at the
 *      current timeIndex.
 *   3. For each canvas pixel (downsampled by `STEP`), compute IDW interpolation
 *      from the sample pixel positions.
 *   4. Map the interpolated value to a colour and fill the pixel block.
 *   5. Layers are composited using `globalCompositeOperation: 'screen'` for
 *      additive blending.
 *
 * Map `moveend`/`zoomend` events trigger a debounced 500ms re-sampling (handled
 * by the parent component which re-fetches grid data).
 */
export default function CloudCanvasOverlay({
  gridData,
  timeIndex,
  highEnabled,
  midEnabled,
  lowEnabled,
}: CloudCanvasOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Redraw function — called on every dependency change.
  useEffect(() => {
    if (!map || !gridData || !canvasRef.current) return;

    const size = map.getSize();
    const canvas = canvasRef.current;

    // Match canvas size to map container.
    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear previous render.
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Convert sample points to pixel coordinates.
    const samplePoints = gridData.samples.map((sample) => {
      const point = map.latLngToContainerPoint([
        sample.latitude,
        sample.longitude,
      ] as [number, number]);
      return { x: point.x, y: point.y };
    });

    // Get cloud values at the current time index.
    const values = getValuesAtTime(gridData, timeIndex);

    // Render step: compute IDW every STEP pixels and fill a STEP×STEP block.
    const STEP = 6;

    // Render each enabled layer with 'screen' compositing.
    const layers: Array<{
      id: "high" | "mid" | "low";
      enabled: boolean;
      values: number[];
    }> = [
      { id: "low", enabled: lowEnabled, values: values.low },
      { id: "mid", enabled: midEnabled, values: values.mid },
      { id: "high", enabled: highEnabled, values: values.high },
    ];

    for (const layer of layers) {
      if (!layer.enabled) continue;

      // Build the IDW input points for this layer.
      const idwPoints = samplePoints.map((sp, i) => ({
        x: sp.x,
        y: sp.y,
        value: layer.values[i] ?? 0,
      }));

      // Set compositing for additive blending.
      ctx.globalCompositeOperation = "screen";

      for (let py = 0; py < canvas.height; py += STEP) {
        for (let px = 0; px < canvas.width; px += STEP) {
          const value = idwInterpolate(px + STEP / 2, py + STEP / 2, idwPoints, 2);
          if (value < 1) continue; // Skip near-zero values for performance.

          const color = cloudLayerValueToColor(layer.id, value);
          ctx.fillStyle = color;
          ctx.fillRect(px, py, STEP, STEP);
        }
      }
    }

    // Reset compositing.
    ctx.globalCompositeOperation = "source-over";
  }, [map, gridData, timeIndex, highEnabled, midEnabled, lowEnabled]);

  // Update canvas position on map move.
  useEffect(() => {
    if (!map || !canvasRef.current) return;

    const updateTransform = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // The canvas covers the entire map container, so no offset is needed.
      // Leaflet's container point system is relative to the container's top-left.
      // We just need to ensure the canvas stays aligned.
    };

    map.on("move", updateTransform);
    map.on("zoom", updateTransform);
    return () => {
      map.off("move", updateTransform);
      map.off("zoom", updateTransform);
    };
  }, [map]);

  if (!gridData) return null;

  return (
    <div
      className="cloud-canvas-overlay"
      data-time-index={timeIndex}
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 350,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block" }}
      />
    </div>
  );
}
