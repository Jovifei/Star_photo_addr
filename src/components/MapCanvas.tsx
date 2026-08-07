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
import {
  CARTO_ATTRIBUTION,
  CARTO_DARK_NOLABELS_URL,
} from "@/lib/constants";
import WorldAtlasOverlay from "@/components/WorldAtlasOverlay";
import ViirsTileLayer from "@/components/ViirsTileLayer";
import BoundaryLayers from "@/components/BoundaryLayers";
import CloudLayer from "@/components/CloudLayer";
import ChineseLabelLayer from "@/components/ChineseLabelLayer";

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

/** Layer toggle configuration for MapCanvas. */
export interface MapCanvasLayers {
  /** VIIRS dark-sky tile layer. Default: true. */
  viirs?: boolean;
  /** Cloud coverage layer. Default: true. */
  cloud?: boolean;
  /** Administrative boundary GeoJSON layers. Default: true. */
  boundaries?: boolean;
  /** Recommendation markers layer. Default: false. */
  recommendations?: boolean;
}

export interface MapCanvasProps {
  mapRef: React.RefObject<LeafletMap | null>;
  onReady?: () => void;
  onSample: (latitude: number, longitude: number) => void;
  center: [number, number];
  zoom: number;
  /** Layer visibility toggles. Unspecified layers default to their documented default. */
  layers?: MapCanvasLayers;
  /** Optional children rendered inside the MapContainer (e.g. recommendation markers). */
  children?: React.ReactNode;
}

/**
 * Reusable Leaflet map canvas.
 *
 * v2 changes:
 *   - Basemap switched from CARTO `dark_all` to `dark_nolabels` (no English labels).
 *   - `ChineseLabelLayer` (Tianditu cia_w) overlaid for Chinese annotations.
 *   - `layers` props allow callers to toggle VIIRS / cloud / boundary / recommendation
 *     layers independently. The `/viirs` recommendation page uses this to show only
 *     the basemap + Chinese labels + recommendation markers.
 *   - `children` prop allows injecting page-specific markers (e.g. RecommendationMarker).
 */
export default function MapCanvas({
  mapRef,
  onReady,
  onSample,
  center,
  zoom,
  layers,
  children,
}: MapCanvasProps) {
  const showViirs = layers?.viirs ?? true;
  const showCloud = layers?.cloud ?? true;
  const showBoundaries = layers?.boundaries ?? true;

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
      {/* z-index 1: dark basemap without labels */}
      <TileLayer
        url={CARTO_DARK_NOLABELS_URL}
        subdomains="abcd"
        attribution={CARTO_ATTRIBUTION}
        maxZoom={19}
      />
      {/* z-index 10: Chinese annotation labels (Tianditu cia_w) */}
      <ChineseLabelLayer />
      <WorldAtlasOverlay />
      {showViirs && <ViirsTileLayer />}
      {showBoundaries && <BoundaryLayers />}
      {showCloud && <CloudLayer />}
      <ClickHandler onSample={onSample} />
      <SampleMarker />
      {children}
    </MapContainer>
  );
}
