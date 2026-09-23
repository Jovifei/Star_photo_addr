"use client";

import { DomEvent, GridLayer, type Layer, type TileEvent } from "leaflet";
import { useMap } from "react-leaflet";
import { useState, useEffect, useRef } from "react";

/** Expose tile failures without pretending the canvas is an empty forecast. */
export default function MapTileStatus() {
  const map = useMap();
  const [error, setError] = useState(false);
  const failedLayers = useRef(new Set<GridLayer>());
  useEffect(() => {
    const bindings = new Map<GridLayer, () => void>();
    const failures = new Map<GridLayer, Set<HTMLElement>>();
    const publish = () => {
      failedLayers.current = new Set([...failures].filter(([, tiles]) => tiles.size).map(([layer]) => layer));
      setError(failedLayers.current.size > 0);
    };
    const bind = (layer: Layer) => {
      if (!(layer instanceof GridLayer) || bindings.has(layer)) return;
      const tiles = new Set<HTMLElement>();
      failures.set(layer, tiles);
      const onError = (event: TileEvent) => { tiles.add(event.tile); publish(); };
      const onRecover = (event: TileEvent) => { tiles.delete(event.tile); publish(); };
      layer.on("tileerror", onError);
      layer.on("tileload", onRecover);
      layer.on("tileunload", onRecover);
      bindings.set(layer, () => {
        layer.off("tileerror", onError);
        layer.off("tileload", onRecover);
        layer.off("tileunload", onRecover);
      });
    };
    const unbind = (layer: Layer) => {
      if (!(layer instanceof GridLayer)) return;
      bindings.get(layer)?.();
      bindings.delete(layer);
      failures.delete(layer);
      publish();
    };
    map.eachLayer(bind);
    const onLayerAdd = (event: { layer: Layer }) => bind(event.layer);
    const onLayerRemove = (event: { layer: Layer }) => unbind(event.layer);
    map.on("layeradd", onLayerAdd);
    map.on("layerremove", onLayerRemove);
    return () => {
      map.off("layeradd", onLayerAdd);
      map.off("layerremove", onLayerRemove);
      bindings.forEach((dispose) => dispose());
      failedLayers.current.clear();
    };
  }, [map]);
  if (!error) return null;
  return (
    <div className="map-tile-error" role="status" ref={(element) => {
      if (element) {
        DomEvent.disableClickPropagation(element);
        DomEvent.disableScrollPropagation(element);
      }
    }}>
      <span>地图底图或图层加载失败；当前画布不代表天气数据为空。</span>
      <button type="button" onClick={() => {
        for (const layer of [...failedLayers.current]) layer.redraw();
      }}>重试地图图层</button>
    </div>
  );
}
