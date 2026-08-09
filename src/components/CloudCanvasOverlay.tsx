"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { CloudGridData } from "@/lib/types";
import {
  idwInterpolate,
  getValuesAtTime,
} from "@/lib/cloudGrid";

interface CloudCanvasOverlayProps {
  gridData: CloudGridData | null;
  timeIndex: number;
  highEnabled: boolean;
  midEnabled: boolean;
  lowEnabled: boolean;
}

/**
 * Canvas overlay that renders cloud coverage as a visible heatmap on the map.
 *
 * Uses IDW interpolation from the 5×6 grid sample points.  Each enabled layer
 * (high / mid / low) is drawn in its own colour channel and blended additively
 * so overlapping cloud layers build up naturally like a satellite cloud map.
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
    const STEP = 5; // slightly denser grid for smoother appearance

    // Layer definitions with distinct base colours.
    const layers: Array<{
      id: "high" | "mid" | "low";
      enabled: boolean;
      values: number[];
      r: number; g: number; b: number;
    }> = [
      { id: "low",  enabled: l, values: values.low,  r: 169, g: 155, b: 247 },
      { id: "mid",  enabled: m, values: values.mid,  r: 212, g: 178, b: 115 },
      { id: "high", enabled: h, values: values.high, r: 121, g: 207, b: 226 },
    ];

    // Use "lighter" (additive) blend so overlapping layers build up.
    ctx.globalCompositeOperation = "lighter";

    for (const layer of layers) {
      if (!layer.enabled) continue;

      const idwPoints = samplePoints.map((sp, i) => ({
        x: sp.x,
        y: sp.y,
        value: layer.values[i] ?? 0,
      }));

      for (let py = 0; py < canvas.height; py += STEP) {
        for (let px = 0; px < canvas.width; px += STEP) {
          const value = idwInterpolate(px + STEP / 2, py + STEP / 2, idwPoints, 2);
          if (value < 0.5) continue;

          // Alpha mapping: 0.5%→0.10, 100%→0.70  — bright enough to read on
          // the dark basemap without washing out the underlying map details.
          const alpha = 0.10 + (value / 100) * 0.60;
          ctx.fillStyle = `rgba(${layer.r},${layer.g},${layer.b},${alpha.toFixed(3)})`;
          ctx.fillRect(px, py, STEP, STEP);
        }
      }
    }

    ctx.globalCompositeOperation = "source-over";
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, gridData, timeIndex, highEnabled, midEnabled, lowEnabled]);

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
        zIndex: 450,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}