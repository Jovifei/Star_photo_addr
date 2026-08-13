"use client";

import { TileLayer, useMap } from "react-leaflet";
import { useState } from "react";
import { useStore } from "@/lib/store";

/** Public VIIRS 2023 light-pollution layer used by the unified finder map. */
const VIIRS_WMTS_URL =
  "https://lpm.darkmap.cn/gwc/service/wmts?layer=PostGIS:VIIR_2023&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}";

export default function ObservingViirsLayer() {
  const { state } = useStore();
  if (state.mapViewMode === "satellite") return null;
  return <ViirsTileLayer key={state.mapViewMode} mode={state.mapViewMode} />;
}

function ViirsTileLayer({ mode }: { mode: "light-pollution" | "combined" }) {
  const map = useMap();
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <TileLayer
      url={VIIRS_WMTS_URL}
      opacity={mode === "combined" ? 0.48 : 0.88}
      attribution="光污染底图 © darkmap.cn（VIIRS 2023）"
      maxZoom={18}
      tileSize={256}
      eventHandlers={{
        tileerror: () => {
          setFailed(true);
          map.getContainer().dataset.observingViirsStatus = "degraded";
        },
        tileload: () => {
          map.getContainer().dataset.observingViirsStatus = "available";
        },
      }}
    />
  );
}
