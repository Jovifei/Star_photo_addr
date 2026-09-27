"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { observeMapViewport } from "@/lib/mapViewportObserver";

export default function MapViewportObserver() {
  const map = useMap();
  useEffect(() => {
    const release = observeMapViewport(map);
    const container = map.getContainer();
    const sync = () => {
      const center = map.getCenter();
      container.dataset.mapCenter = `${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
      container.dataset.mapZoom = String(map.getZoom());
    };
    map.on("moveend zoomend", sync);
    sync();
    return () => {
      release();
      map.off("moveend zoomend", sync);
      delete container.dataset.mapCenter;
      delete container.dataset.mapZoom;
    };
  }, [map]);
  return null;
}
