"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useStore } from "@/lib/store";
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_SUBDOMAINS,
  BASEMAP_TILE_CLASS_NAME,
  BASEMAP_TILE_URL,
} from "@/lib/constants";
import WorldAtlasOverlay from "@/components/WorldAtlasOverlay";
import BoundaryLayers from "@/components/BoundaryLayers";
import CloudLayer from "@/components/CloudLayer";
import SatelliteLayer from "@/components/SatelliteLayer";
import ChineseLabelLayer from "@/components/ChineseLabelLayer";
import ObservingViirsLayer from "@/components/ObservingViirsLayer";
import ObservingSitesLayer from "@/components/ObservingSitesLayer";

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

/** Minimum zoom level applied when auto-recentering on a newly selected location. */
const RECENTER_MIN_ZOOM = 8;

/**
 * Pans the map to `state.selectedLocation` whenever it changes.
 *
 * Must be rendered as a child of `MapContainer` so that `useMap()` resolves.
 * Never zooms out: the target zoom is `max(currentZoom, RECENTER_MIN_ZOOM)`.
 */
function RecenterOnSelected({ enabled = true }: { enabled?: boolean }) {
  const map = useMap();
  const { state } = useStore();
  const lat = state.selectedLocation?.latitude;
  const lon = state.selectedLocation?.longitude;

  useEffect(() => {
    if (!enabled || lat == null || lon == null) return;
    map.setView([lat, lon], Math.max(map.getZoom(), RECENTER_MIN_ZOOM), {
      animate: true,
    });
  }, [enabled, lat, lon, map]);

  return null;
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
  /** 选中地点变化时是否自动重定位。默认 true。 */
  recenterOnSelect?: boolean;
  /** Optional children rendered inside the MapContainer (e.g. recommendation markers). */
  children?: React.ReactNode;
}

/**
 * Reusable Leaflet map canvas.
 *
 * v2 changes:
 *   - Basemap is configured centrally; the zero-config fallback is OSM with a dark client filter.
 *   - `ChineseLabelLayer` (Tianditu cia_w) overlaid for Chinese annotations.
 *   - `layers` props allow callers to toggle VIIRS / cloud / boundary / recommendation
 *     layers independently. The `/viirs` recommendation page uses this to show only
 *     the basemap + Chinese labels + recommendation markers.
 *   - `children` prop allows injecting page-specific markers (e.g. RecommendationMarker).
 *   - `recenterOnSelect` auto-pans the map to the store's selected location. The
 *     `/viirs` page opts out so a previously selected location does not hijack
 *     the nationwide overview on mount.
 */
export default function MapCanvas({
  mapRef,
  onReady,
  onSample,
  center,
  zoom,
  layers,
  recenterOnSelect = true,
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
      // Keep the view within one world so cloud sampling longitudes stay valid
      // (the grid clamps too, but this prevents panning into empty oceans).
      maxBounds={[
        [-85, -180],
        [85, 180],
      ]}
      maxBoundsViscosity={1.0}
      className="map-canvas"
      whenReady={() => onReady?.()}
    >
      {/* z-index 1: dark basemap without labels */}
      <TileLayer
        url={BASEMAP_TILE_URL}
        subdomains={BASEMAP_SUBDOMAINS}
        attribution={BASEMAP_ATTRIBUTION}
        className={BASEMAP_TILE_CLASS_NAME}
        maxZoom={19}
      />
      {/* z-index 10: Chinese annotation labels (Tianditu cia_w) */}
      <ChineseLabelLayer />
      <WorldAtlasOverlay />
      {showViirs && <ObservingViirsLayer />}
      {showBoundaries && <BoundaryLayers />}
      {showCloud && <CloudLayer />}
      {showCloud && <SatelliteLayer />}
      {showCloud && <ObservingSitesLayer />}
      <ClickHandler onSample={onSample} />
      <SampleMarker />
      <RecenterOnSelected enabled={recenterOnSelect} />
      {children}
    </MapContainer>
  );
}
