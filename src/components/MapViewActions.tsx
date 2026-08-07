"use client";

import type { Map as LeafletMap } from "leaflet";
import { CHINA_BOUNDS } from "@/lib/constants";

/** Quick-view buttons (China / World / Sample centre) + boundary legend. */
export default function MapViewActions({
  mapRef,
}: {
  mapRef: React.RefObject<LeafletMap | null>;
}) {
  const flyTo = (lat: number, lng: number, zoom: number) => {
    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.8 });
  };

  return (
    <div className="map-view-actions">
      <div className="boundary-legend" aria-label="行政边界图例">
        <span>
          <i className="country" />
          国界
        </span>
        <span>
          <i className="province" />
          省份 / 省界 · z4+
        </span>
        <span>
          <i className="prefecture" />
          城市 / 市界 · z6+
        </span>
        <small>省市名称随缩放逐级显示 · 边界仅作位置参考</small>
      </div>
      <button type="button" onClick={() => flyTo(34, 108, 4)}>
        中国视图
      </button>
      <button type="button" onClick={() => flyTo(20, 0, 2)}>
        全球视图
      </button>
      <button
        type="button"
        onClick={() =>
          flyTo(
            (CHINA_BOUNDS.north + CHINA_BOUNDS.south) / 2,
            (CHINA_BOUNDS.east + CHINA_BOUNDS.west) / 2,
            4,
          )
        }
      >
        取样中心
      </button>
    </div>
  );
}
