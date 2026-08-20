"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useStore } from "@/lib/store";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";
import MapHeadline from "@/components/MapHeadline";
import MapViewActions from "@/components/MapViewActions";
import MapSearchCard from "@/components/MapSearchCard";
import MapSetup from "@/components/MapSetup";
import MapLegend from "@/components/MapLegend";
import BortleControl from "@/components/BortleControl";
import CloudControl from "@/components/CloudControl";
import CloudTimeline from "@/components/CloudTimeline";
import ObservingMapControl from "@/components/ObservingMapControl";
import ViewportRecommendationMarkers from "@/components/ViewportRecommendationMarkers";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";

// Leaflet touches `window`, so the map is client-only.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});

/**
 * Map stage: orchestrates the Leaflet canvas and all overlay controls.
 *
 * The viewport recommendation panel is deliberately user-triggered: moving or
 * zooming the map only marks the shortlist dirty; pressing “更新此区域” applies
 * the new bounds and reuses the existing observation snapshot cache.
 */
export default function MapStage() {
  const mapRef = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const [viewportRecommendations, setViewportRecommendations] = useState<
    ViewportRecommendation[]
  >([]);
  const { sampleAt } = useStore();

  return (
    <section className="map-stage">
      <div className="map-viewport">
        <MapCanvas
          mapRef={mapRef}
          onReady={() => setReady(true)}
          onSample={(latitude: number, longitude: number) =>
            void sampleAt(latitude, longitude)
          }
          center={[34, 108]}
          zoom={4}
          layers={{
            viirs: true,
            cloud: true,
            boundaries: true,
            recommendations: false,
          }}
        >
          <ViewportRecommendationMarkers
            recommendations={viewportRecommendations}
          />
        </MapCanvas>
        <MapHeadline />
        <MapViewActions mapRef={mapRef} />
        <MapSearchCard />
        <BortleControl />
        <CloudControl />
        <ObservingMapControl />
        <ViewportRecommendationPanel
          mapRef={mapRef}
          ready={ready}
          onRecommendationsChange={setViewportRecommendations}
        />
        <MapLegend />
        <MapSetup hidden={ready} />
      </div>
      <CloudTimeline />
    </section>
  );
}
