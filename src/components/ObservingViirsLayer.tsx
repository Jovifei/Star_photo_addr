"use client";

import { TileLayer } from "react-leaflet";
import { useStore } from "@/lib/store";

/** Public VIIRS 2023 light-pollution layer used by the unified finder map. */
const VIIRS_WMTS_URL =
  "https://lpm.darkmap.cn/gwc/service/wmts?layer=PostGIS:VIIR_2023&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}";

export default function ObservingViirsLayer() {
  const { state } = useStore();
  if (state.mapViewMode === "satellite") return null;
  return (
    <TileLayer
      key={`observing-viirs-${state.mapViewMode}`}
      url={VIIRS_WMTS_URL}
      opacity={state.mapViewMode === "combined" ? 0.48 : 0.88}
      attribution="光污染底图 © darkmap.cn（VIIRS 2023）"
      maxZoom={18}
      tileSize={256}
    />
  );
}
