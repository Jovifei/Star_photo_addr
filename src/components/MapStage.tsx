"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useStore } from "@/lib/store";
import MapHeadline from "@/components/MapHeadline";
import MapViewActions from "@/components/MapViewActions";
import MapSearchCard from "@/components/MapSearchCard";
import MapSetup from "@/components/MapSetup";
import MapLegend from "@/components/MapLegend";
import BortleControl from "@/components/BortleControl";
import CloudControl from "@/components/CloudControl";
import CloudTimeline from "@/components/CloudTimeline";
import ObservingMapControl from "@/components/ObservingMapControl";

// Leaflet touches `window`, so the map is client-only.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});

/**
 * Map stage: orchestrates the Leaflet canvas and all overlay controls.
 *
 * v2: keeps the forecast panel below the map viewport so a large matrix never
 * obscures the map. The panel has its own bounded scroll region.
 */
export default function MapStage() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const { sampleAt } = useStore();

  return (
    <section className="map-stage">
      <div className="map-viewport">
        <MapCanvas
          mapRef={mapRef}
          onReady={() => setReady(true)}
          onSample={(latitude, longitude) => void sampleAt(latitude, longitude)}
          center={[34, 108]}
          zoom={4}
          layers={{ viirs: true, cloud: true, boundaries: true, recommendations: false }}
        />
        <MapHeadline />
        <MapViewActions mapRef={mapRef} />
        <MapSearchCard />
        <BortleControl />
        <CloudControl />
        <ObservingMapControl />
        <MapLegend />
        <MapSetup hidden={ready} />
      </div>
      <CloudTimeline />
    </section>
  );
}
