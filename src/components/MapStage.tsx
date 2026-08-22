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
import MapLayerBar from "@/components/MapLayerBar";
import ForecastThemeSwitch from "@/components/ForecastThemeSwitch";
import MapSetup from "@/components/MapSetup";
import MapLegend from "@/components/MapLegend";
import BortleControl from "@/components/BortleControl";
import CloudControl from "@/components/CloudControl";
import CloudTimeline from "@/components/CloudTimeline";
import ObservingMapControl from "@/components/ObservingMapControl";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";

// Leaflet and the persisted panel manager are browser-owned. Keep both behind
// client-only boundaries so server prerendering never reads window/localStorage.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});
const ViewportRecommendationMarkers = dynamic(
  () => import("@/components/ViewportRecommendationMarkers"),
  { ssr: false },
);
const MapPanelManager = dynamic(
  () => import("@/components/MapPanelManager"),
  { ssr: false },
);
const MapBoundaryStatus = dynamic(
  () => import("@/components/MapBoundaryStatus"),
  { ssr: false },
);

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
        <ForecastThemeSwitch />
        <MapLayerBar />
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
