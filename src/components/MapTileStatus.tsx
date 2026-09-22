"use client";

import type { Layer } from "leaflet";
import { useMap } from "react-leaflet";
import { useState } from "react";
import { useEffect } from "react";

/** Expose tile failures without pretending the canvas is an empty forecast. */
export default function MapTileStatus() {
  const map = useMap();
  const [error, setError] = useState(false);
  useEffect(() => {
    const onError = () => setError(true);
    const bind = (layer: Layer) => {
      layer.on("tileerror", onError);
    };
    const unbind = (layer: Layer) => {
      layer.off("tileerror", onError);
    };
    map.eachLayer(bind);
    const onLayerAdd = (event: { layer: Layer }) => bind(event.layer);
    const onLayerRemove = (event: { layer: Layer }) => unbind(event.layer);
    map.on("layeradd", onLayerAdd);
    map.on("layerremove", onLayerRemove);
    return () => {
      map.off("layeradd", onLayerAdd);
      map.off("layerremove", onLayerRemove);
      map.eachLayer(unbind);
    };
  }, [map]);
  if (!error) return null;
  return (
    <div className="map-tile-error" role="status">
      地图底图或图层加载失败；当前画布不代表天气数据为空，请检查网络后重试。
    </div>
  );
}
