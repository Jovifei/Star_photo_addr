"use client";

import { CircleMarker } from "react-leaflet";
import { useEffect, useRef } from "react";
import type { CircleMarker as LeafletCircleMarker } from "leaflet";
import type { Coordinate } from "@/lib/nearbyDirectorySites";
import { useMapBlankTap } from "@/hooks/useMapBlankTap";

export default function BlankMapPicker({ point, onPick }: {
  point: Coordinate | null;
  onPick: (point: Coordinate) => void;
}) {
  const markerRef = useRef<LeafletCircleMarker | null>(null);
  useMapBlankTap(
    (latitude, longitude) => onPick({ latitude, longitude }),
    ".topic-site-marker, .topic-pick-marker, .leaflet-control, .leaflet-popup, .leaflet-tooltip",
  );
  useEffect(() => {
    const element = markerRef.current?.getElement();
    if (!element) return;
    element.classList.add("topic-pick-marker");
    return () => element.classList.remove("topic-pick-marker");
  }, [point]);
  if (!point) return null;
  return <CircleMarker ref={markerRef} center={[point.latitude, point.longitude]} radius={8}
    pathOptions={{ className: "topic-pick-marker", color: "#ffffff", fillColor: "#69c7d6", fillOpacity: 0.72, weight: 2, bubblingMouseEvents: false }} />;
}
