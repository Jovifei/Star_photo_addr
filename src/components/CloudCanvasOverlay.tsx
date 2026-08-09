"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { CloudDisplayMode, CloudGridData } from "@/lib/types";
import {
  bilinearInterpolate,
  getCloudCoverAtTime,
  getValuesAtTime,
  getWeatherValuesAtTime,
} from "@/lib/cloudGrid";

interface CloudCanvasOverlayProps {
  gridData: CloudGridData | null;
  timeIndex: number;
  activeForecastTime?: string | null;
  displayMode: CloudDisplayMode;
  showPrecipitation?: boolean;
  showWind?: boolean;
}

/**
 * Render one forecast channel as a continuous, neutral raster.
 *
 * This intentionally does not look like satellite imagery: observed tiles
 * are rendered by SatelliteLayer. Forecast values are sampled on a regular
 * grid, bilinearly interpolated, and composited with source-over so individual
 * provider sample points cannot become bright halos.
 */
export default function CloudCanvasOverlay({
  gridData,
  timeIndex,
  activeForecastTime,
  displayMode,
  showPrecipitation = false,
  showWind = false,
}: CloudCanvasOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const propsRef = useRef({ gridData, timeIndex, activeForecastTime, displayMode, showPrecipitation, showWind });

  useEffect(() => {
    propsRef.current = { gridData, timeIndex, activeForecastTime, displayMode, showPrecipitation, showWind };
  }, [activeForecastTime, displayMode, gridData, showPrecipitation, showWind, timeIndex]);

  const draw = () => {
    const { gridData: data, timeIndex: ti, activeForecastTime: activeTime, displayMode: mode, showPrecipitation: rainEnabled, showWind: windEnabled } = propsRef.current;
    const canvas = canvasRef.current;
    if (!map || !data || !canvas) return;

    const size = map.getSize();
    if (size.x === 0 || size.y === 0) return;

    // Render at half resolution and let the browser smooth the display-sized
    // canvas. This keeps map panning responsive without blocky 5px squares.
    const scale = 0.5;
    canvas.width = Math.max(1, Math.ceil(size.x * scale));
    canvas.height = Math.max(1, Math.ceil(size.y * scale));
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.globalCompositeOperation = "source-over";

    const samplePoints = data.samples.map((sample) => {
      const point = map.latLngToContainerPoint([sample.latitude, sample.longitude] as [number, number]);
      return { x: point.x * scale, y: point.y * scale };
    });
    const minX = Math.min(...samplePoints.map((point) => point.x));
    const maxX = Math.max(...samplePoints.map((point) => point.x));
    const minY = Math.min(...samplePoints.map((point) => point.y));
    const maxY = Math.max(...samplePoints.map((point) => point.y));
    const rows = data.rows ?? 5;
    const cols = data.cols ?? 6;
    const time = activeTime ?? ti;
    const layerValues = getValuesAtTime(data, time);
    const values = mode === "total"
      ? getCloudCoverAtTime(data, time)
      : layerValues[mode];

    const validSamples = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    if (validSamples.length < 2 || maxX <= minX || maxY <= minY) return;

    const pixels = ctx.createImageData(canvas.width, canvas.height);
    for (let py = 0; py < canvas.height; py += 1) {
      for (let px = 0; px < canvas.width; px += 1) {
        const u = ((px + 0.5 - minX) / Math.max(1, maxX - minX)) * (cols - 1);
        const v = ((py + 0.5 - minY) / Math.max(1, maxY - minY)) * (rows - 1);
        const value = bilinearInterpolate(u, v, values, rows, cols);
        if (value == null || value < 5) continue;
        const normalized = Math.max(0, Math.min(100, value)) / 100;
        const alpha = Math.min(0.68, Math.max(0.08, (normalized - 0.03) * 0.64));
        const [red, green, blue] = mode === "high"
          ? [121, 207, 226]
          : mode === "mid"
            ? [212, 178, 115]
            : mode === "low"
              ? [169, 155, 247]
              : [190, 213, 222];
        const offset = (py * canvas.width + px) * 4;
        pixels.data[offset] = red;
        pixels.data[offset + 1] = green;
        pixels.data[offset + 2] = blue;
        pixels.data[offset + 3] = Math.round(alpha * 255);
      }
    }
    ctx.putImageData(pixels, 0, 0);

    const weather = getWeatherValuesAtTime(data, time);
    if (rainEnabled) {
      for (let py = 0; py < canvas.height; py += 2) {
        for (let px = 0; px < canvas.width; px += 2) {
          const u = ((px + 0.5 - minX) / Math.max(1, maxX - minX)) * (cols - 1);
          const v = ((py + 0.5 - minY) / Math.max(1, maxY - minY)) * (rows - 1);
          const rain = bilinearInterpolate(u, v, weather.precipitation, rows, cols);
          if (rain == null || rain < 0.1) continue;
          const intensity = Math.max(0, Math.min(1, rain / 5));
          const color = intensity > 0.65 ? "238, 120, 101" : intensity > 0.3 ? "230, 194, 105" : "96, 196, 224";
          ctx.fillStyle = `rgba(${color}, ${(0.12 + intensity * 0.22).toFixed(3)})`;
          ctx.fillRect(px, py, 2, 2);
        }
      }
    }

    if (windEnabled) {
      ctx.save();
      ctx.strokeStyle = "rgba(232, 246, 246, .72)";
      ctx.fillStyle = "rgba(232, 246, 246, .72)";
      ctx.lineWidth = 1.2;
      for (let index = 0; index < samplePoints.length; index += Math.max(1, Math.floor(samplePoints.length / 28))) {
        const point = samplePoints[index];
        const speed = weather.windSpeed[index];
        const direction = weather.windDirection[index];
        if (speed == null || direction == null || !Number.isFinite(speed) || !Number.isFinite(direction)) continue;
        const radians = ((direction + 180) * Math.PI) / 180;
        const length = Math.min(30, 8 + speed * 3) * scale;
        const dx = Math.sin(radians) * length;
        const dy = -Math.cos(radians) * length;
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x + dx, point.y + dy);
        ctx.stroke();
        const head = 4 * scale;
        ctx.beginPath();
        ctx.moveTo(point.x + dx, point.y + dy);
        ctx.lineTo(point.x + dx - Math.sin(radians - 0.55) * head, point.y + dy + Math.cos(radians - 0.55) * head);
        ctx.lineTo(point.x + dx - Math.sin(radians + 0.55) * head, point.y + dy + Math.cos(radians + 0.55) * head);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  };

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeForecastTime, displayMode, gridData, map, showPrecipitation, showWind, timeIndex]);

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
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  if (!gridData) return null;

  return (
    <div
      className="cloud-canvas-overlay"
      data-time-iso={activeForecastTime ?? ""}
      data-cloud-mode={displayMode}
      data-precipitation={showPrecipitation ? "on" : "off"}
      data-wind={showWind ? "on" : "off"}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 450,
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
