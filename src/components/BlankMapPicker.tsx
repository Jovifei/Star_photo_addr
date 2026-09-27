"use client";

import { CircleMarker } from "react-leaflet";
import type { Coordinate } from "@/lib/nearbyDirectorySites";
import { useMapBlankTap } from "@/hooks/useMapBlankTap";

export default function BlankMapPicker({ point, onPick }: {
  point: Coordinate | null;
  onPick: (point: Coordinate) => void;
}) {
  useMapBlankTap(
    (latitude, longitude) => onPick({ latitude, longitude }),
    ".topic-site-marker, .topic-pick-marker, .leaflet-control, .leaflet-popup, .leaflet-tooltip",
  );
  if (!point) return null;
  return <CircleMarker center={[point.latitude, point.longitude]} radius={8}
    pathOptions={{ className: "topic-pick-marker", color: "#ffffff", fillColor: "#69c7d6", fillOpacity: 0.72, weight: 2, bubblingMouseEvents: false }} />;
}
