"use client";

import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";
import { CARTO_ATTRIBUTION, CARTO_DARK_URL } from "@/lib/constants";
import WorldAtlasOverlay from "@/components/WorldAtlasOverlay";
import ViirsTileLayer from "@/components/ViirsTileLayer";
import BoundaryLayers from "@/components/BoundaryLayers";
import CloudLayer from "@/components/CloudLayer";

function ClickHandler({
  onSample,
}: {
  onSample: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onSample(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function SampleMarker() {
  const { state } = useStore();
  const location = state.selectedLocation;
  if (!location) return null;
  return (
    <CircleMarker
      center={[location.latitude, location.longitude]}
      radius={8}
      pathOptions={{
        color: "#79cfe2",
        fillColor: "#79cfe2",
        fillOpacity: 0.65,
        weight: 2,
      }}
    >
      <Tooltip direction="top">{location.name}</Tooltip>
    </CircleMarker>
  );
}

export interface MapCanvasProps {
  mapRef: React.RefObject<LeafletMap | null>;
  onReady?: () => void;
  onSample: (latitude: number, longitude: number) => void;
  center: [number, number];
  zoom: number;
}

export default function MapCanvas({
  mapRef,
  onReady,
  onSample,
  center,
  zoom,
}: MapCanvasProps) {
  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={zoom}
      minZoom={2}
      maxZoom={12}
      zoomControl
      worldCopyJump={false}
      className="map-canvas"
      whenReady={() => onReady?.()}
    >
      <TileLayer
        url={CARTO_DARK_URL}
        subdomains="abcd"
        attribution={CARTO_ATTRIBUTION}
        maxZoom={19}
      />
      <WorldAtlasOverlay />
      <ViirsTileLayer />
      <BoundaryLayers />
      <CloudLayer />
      <ClickHandler onSample={onSample} />
      <SampleMarker />
    </MapContainer>
  );
}
