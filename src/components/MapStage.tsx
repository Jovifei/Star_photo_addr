"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useStore } from "@/lib/store";
import { describeSamplePoint } from "@/lib/locationPresentation";
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
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";
import MapPanelManager from "@/components/MapPanelManager";
import MapBoundaryStatus from "@/components/MapBoundaryStatus";

// Leaflet touches `window`, so both the map and any child component importing
// Leaflet at module scope must remain behind a client-only dynamic boundary.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});
const ViewportRecommendationMarkers = dynamic(
  () => import("@/components/ViewportRecommendationMarkers"),
  { ssr: false },
);

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
            void sampleAt(
              latitude,
              longitude,
              0,
              describeSamplePoint(latitude, longitude),
            )
          }
          center={[35.5, 104.5]}
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
        <MapPanelManager />
        <MapBoundaryStatus />
        <MapSetup hidden={ready} />
      </div>
      <CloudTimeline />
    </section>
  );
}
