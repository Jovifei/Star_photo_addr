"use client";

import { DomEvent, GridLayer, type Layer, type TileEvent } from "leaflet";
import { useMap } from "react-leaflet";
import { useState, useEffect, useRef } from "react";

function tileKey({ coords: { x, y, z } }: TileEvent) {
  return `${x}:${y}:${z}`;
}

/** Expose tile failures without pretending the canvas is an empty forecast. */
export default function MapTileStatus() {
  const map = useMap();
  const [error, setError] = useState(false);
  const retryFailedLayers = useRef<(() => void) | null>(null);
  useEffect(() => {
    const bindings = new Map<GridLayer, () => void>();
    const failures = new Map<GridLayer, Map<string, HTMLElement | null>>();
    let redrawing: GridLayer | null = null;
    const publish = () => setError([...failures.values()].some((tiles) => tiles.size > 0));
    const bind = (layer: Layer) => {
      if (!(layer instanceof GridLayer) || bindings.has(layer)) return;
      const tiles = new Map<string, HTMLElement | null>();
      failures.set(layer, tiles);
      const onError = (event: TileEvent) => { tiles.set(tileKey(event), event.tile); publish(); };
      const onStart = (event: TileEvent) => {
        const key = tileKey(event);
        if (tiles.get(key) === null) tiles.set(key, event.tile);
      };
      const onLoad = (event: TileEvent) => {
        const key = tileKey(event);
        if (tiles.get(key) !== event.tile) return;
        tiles.delete(key);
        publish();
      };
      const onUnload = (event: TileEvent) => {
        const key = tileKey(event);
        if (tiles.get(key) !== event.tile) return;
        // Redraw unloads the broken image before scheduling its replacement.
        if (redrawing === layer) tiles.set(key, null);
        else onLoad(event);
      };
      const events = {
        tileerror: onError,
        tileloadstart: onStart,
        tileload: onLoad,
        tileunload: onUnload,
        tileabort: onUnload,
      };
      layer.on(events);
      bindings.set(layer, () => layer.off(events));
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
    retryFailedLayers.current = () => {
      for (const [layer, tiles] of failures) {
        if (!tiles.size) continue;
        redrawing = layer;
        try {
          layer.redraw();
        } finally {
          redrawing = null;
          // Leaflet queues visible replacements synchronously. Drop offscreen tiles.
          for (const [key, tile] of tiles) {
            if (tile === null) tiles.delete(key);
          }
          publish();
        }
      }
    };
    return () => {
      map.off("layeradd", onLayerAdd);
      map.off("layerremove", onLayerRemove);
      bindings.forEach((dispose) => dispose());
      retryFailedLayers.current = null;
    };
  }, [map]);
  if (!error) return null;
  return (
    <div
      className="map-tile-error map-render-status map-render-status--tile"
      data-testid="map-tile-render-status"
      role="status"
      ref={(element) => {
      if (element) {
        DomEvent.disableClickPropagation(element);
        DomEvent.disableScrollPropagation(element);
      }
      }}
    >
      <span>地图底图或图层加载失败；当前画布不代表天气数据为空。</span>
      <button type="button" onClick={() => retryFailedLayers.current?.()}>重试地图图层</button>
    </div>
  );
}
