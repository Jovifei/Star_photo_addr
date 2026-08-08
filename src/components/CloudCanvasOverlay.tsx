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
 * redraws on prop changes AND on every map move/zoom/resize (rAF-throttled) so
 * the coverage stays aligned with the basemap while panning.
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
  const rafRef = useRef<number | null>(null);

  // Keep latest props in a ref so the move/zoom listener always redraws with
  // current data without re-subscribing on every prop change.
  const propsRef = useRef({ gridData, timeIndex, highEnabled, midEnabled, lowEnabled });
  useEffect(() => {
    propsRef.current = { gridData, timeIndex, highEnabled, midEnabled, lowEnabled };
  }, [gridData, timeIndex, highEnabled, midEnabled, lowEnabled]);

  const draw = () => {
    const { gridData: data, timeIndex: ti, highEnabled: h, midEnabled: m, lowEnabled: l } =
      propsRef.current;
    const canvas = canvasRef.current;
    if (!map || !data || !canvas) return;

    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;

    canvas.width = size.x;
    canvas.height = size.y;
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Convert sample points to pixel coordinates.
    const samplePoints = data.samples.map((sample) => {
      const point = map.latLngToContainerPoint([
        sample.latitude,
        sample.longitude,
      ] as [number, number]);
      return { x: point.x, y: point.y };
    });

    const values = getValuesAtTime(data, ti);
    const STEP = 6;

    const layers: Array<{
      id: "high" | "mid" | "low";
      enabled: boolean;
      values: number[];
    }> = [
      { id: "low", enabled: l, values: values.low },
      { id: "mid", enabled: m, values: values.mid },
      { id: "high", enabled: h, values: values.high },
    ];

    for (const layer of layers) {
      if (!layer.enabled) continue;

      const idwPoints = samplePoints.map((sp, i) => ({
        x: sp.x,
        y: sp.y,
        value: layer.values[i] ?? 0,
      }));

      ctx.globalCompositeOperation = "screen";

      for (let py = 0; py < canvas.height; py += STEP) {
        for (let px = 0; px < canvas.width; px += STEP) {
          const value = idwInterpolate(px + STEP / 2, py + STEP / 2, idwPoints, 2);
          if (value < 1) continue;

          const color = cloudLayerValueToColor(layer.id, value);
          ctx.fillStyle = color;
          ctx.fillRect(px, py, STEP, STEP);
        }
      }
    }

    ctx.globalCompositeOperation = "source-over";
  };

  // Redraw whenever the relevant props change.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, gridData, timeIndex, highEnabled, midEnabled, lowEnabled]);

  // Redraw (rAF-throttled) while the map is moved / zoomed / resized so the
  // cloud field tracks the basemap instead of staying at stale pixel positions.
  useEffect(() => {
    if (!map) return;

    const schedule = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        draw();
      });
    };

    map.on("move", schedule);
    map.on("zoom", schedule);
    map.on("resize", schedule);

    return () => {
      map.off("move", schedule);
      map.off("zoom", schedule);
      map.off("resize", schedule);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
