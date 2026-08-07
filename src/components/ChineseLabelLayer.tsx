"use client";

import { TileLayer } from "react-leaflet";
import {
  TIANDITU_CIA_W_URL,
  TIANDITU_ATTRIBUTION,
} from "@/lib/constants";

/**
 * Tianditu `cia_w` (imagery annotation) tile layer — renders Chinese labels
 * on top of the dark CARTO basemap.
 *
 * - `cia_w` uses light-coloured text designed for dark/satellite basemaps,
 *   so it blends naturally with the dark theme.
 * - Subdomains "01234567" map to t0..t7.tianditu.gov.cn.
 * - `zIndex: 10` places it above the basemap (zIndex 1) but below VIIRS (20),
 *   boundaries (30), and cloud overlay (40).
 * - If `NEXT_PUBLIC_TIANDITU_TOKEN` is not configured, the component returns
 *   `null` and the basemap displays without labels (graceful degradation).
 */
export default function ChineseLabelLayer() {
  // The URL constant already has the tk appended (or is empty string).
  // If no token was configured, the URL ends with `tk=` (empty value).
  // In that case we skip rendering to avoid 403 errors from Tianditu.
  const tk = process.env.NEXT_PUBLIC_TIANDITU_TOKEN ?? "";
  if (!tk) return null;

  return (
    <TileLayer
      url={TIANDITU_CIA_W_URL}
      subdomains="01234567"
      attribution={TIANDITU_ATTRIBUTION}
      zIndex={10}
      maxZoom={18}
      opacity={0.85}
    />
  );
}
