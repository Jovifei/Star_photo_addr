"use client";

import { CircleMarker, Pane, TileLayer, Tooltip } from "react-leaflet";
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
  if (!tk) {
    return (
      <Pane name="chinese-fallback-labels" style={{ zIndex: 450, pointerEvents: "none" }}>
        {CHINESE_FALLBACK_LABELS.map((label) => (
          <CircleMarker
            key={label.name}
            center={[label.latitude, label.longitude]}
            radius={1}
            interactive={false}
            pathOptions={{ opacity: 0, fillOpacity: 0 }}
          >
            <Tooltip
              permanent
              direction="center"
              opacity={1}
              className="chinese-fallback-label"
            >
              {label.name}
            </Tooltip>
          </CircleMarker>
        ))}
      </Pane>
    );
  }

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

const CHINESE_FALLBACK_LABELS = [
  { name: "北京", latitude: 39.9, longitude: 116.4 },
  { name: "上海", latitude: 31.23, longitude: 121.47 },
  { name: "广州", latitude: 23.13, longitude: 113.26 },
  { name: "杭州", latitude: 30.27, longitude: 120.15 },
  { name: "南京", latitude: 32.06, longitude: 118.8 },
  { name: "武汉", latitude: 30.59, longitude: 114.3 },
  { name: "成都", latitude: 30.57, longitude: 104.07 },
  { name: "西安", latitude: 34.34, longitude: 108.94 },
  { name: "昆明", latitude: 25.04, longitude: 102.71 },
  { name: "拉萨", latitude: 29.65, longitude: 91.12 },
  { name: "乌鲁木齐", latitude: 43.83, longitude: 87.62 },
  { name: "哈尔滨", latitude: 45.8, longitude: 126.53 },
];
