"use client";

import { CircleMarker, Pane, TileLayer, Tooltip } from "react-leaflet";
import {
  TIANDITU_CIA_W_URL,
  TIANDITU_ATTRIBUTION,
} from "@/lib/constants";

/** Official Tianditu global-boundary WMTS, enabled by the same build-time key. */
function boundaryUrl(token: string): string {
  return (
    "https://t{s}.tianditu.gov.cn/ibo_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
    "&LAYER=ibo&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles" +
    "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=" +
    encodeURIComponent(token)
  );
}

/**
 * Chinese annotations and official administrative boundary tiles.
 *
 * With `NEXT_PUBLIC_TIANDITU_TOKEN`, the map uses Tianditu `ibo_w` for global
 * boundaries plus `cia_w` for Chinese annotations. Without a token it falls
 * back to a small set of Chinese orientation labels and never draws an
 * unverified national/provincial polygon.
 */
export default function ChineseLabelLayer() {
  const tk = process.env.NEXT_PUBLIC_TIANDITU_TOKEN ?? "";
  if (!tk) {
    return (
      <Pane
        name="chinese-fallback-labels"
        style={{ zIndex: 450, pointerEvents: "none" }}
      >
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
    <>
      <TileLayer
        url={boundaryUrl(tk)}
        subdomains="01234567"
        attribution={TIANDITU_ATTRIBUTION}
        zIndex={9}
        maxZoom={18}
        opacity={0.62}
        className="tianditu-boundary-layer"
      />
      <TileLayer
        url={TIANDITU_CIA_W_URL}
        subdomains="01234567"
        attribution={TIANDITU_ATTRIBUTION}
        zIndex={10}
        maxZoom={18}
        opacity={0.88}
      />
    </>
  );
}

const CHINESE_FALLBACK_LABELS = [
  { name: "中国", latitude: 35.5, longitude: 104.5 },
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
