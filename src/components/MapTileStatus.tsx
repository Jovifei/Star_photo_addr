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
    let moving = false;
    let zooming = false;
    let pruneQueued = false;
    const publish = () => setError([...failures.values()].some((tiles) => tiles.size > 0));
    const pruneUnloadedTiles = () => {
      if (moving || zooming || pruneQueued) return;
      // Give Leaflet's layer handlers the rest of this turn to queue replacements.
      pruneQueued = true;
      queueMicrotask(() => {
        pruneQueued = false;
        if (moving || zooming) return;
        let changed = false;
        for (const tiles of failures.values()) {
          for (const [key, tile] of tiles) {
            if (tile !== null) continue;
            tiles.delete(key);
            changed = true;
          }
        }
        if (changed) publish();
      });
    };
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
        tiles.set(key, null);
        pruneUnloadedTiles();
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
    const mapEvents = {
      layeradd: (event: { layer: Layer }) => bind(event.layer),
      layerremove: (event: { layer: Layer }) => unbind(event.layer),
      movestart: () => { moving = true; },
      moveend: () => { moving = false; pruneUnloadedTiles(); },
      // Resizing can emit moveend in the middle of an active zoom.
      zoomstart: () => { zooming = true; },
      zoomend: () => { zooming = false; pruneUnloadedTiles(); },
    };
    map.on(mapEvents);
    retryFailedLayers.current = () => {
      for (const [layer, tiles] of failures) {
        if (tiles.size) layer.redraw();
      }
    };
    return () => {
      map.off(mapEvents);
      bindings.forEach((dispose) => dispose());
      failures.clear();
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
