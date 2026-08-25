"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useStore } from "@/lib/store";
import { describeSamplePoint } from "@/lib/locationPresentation";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";
import MapHeadline from "@/components/MapHeadline";
import MapSearchCard from "@/components/MapSearchCard";
import MapSetup from "@/components/MapSetup";
import CloudTimeline from "@/components/CloudTimeline";

// Leaflet and viewport-dependent controls are browser-owned. Keep them behind
// client-only boundaries so server prerendering never reads window/localStorage.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});
const ViewportRecommendationMarkers = dynamic(
  () => import("@/components/ViewportRecommendationMarkers"),
  { ssr: false },
);
const ResponsiveMapControls = dynamic(
  () => import("@/components/ResponsiveMapControls"),
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
        <MapSearchCard />
        <ResponsiveMapControls
          mapRef={mapRef}
          ready={ready}
          onRecommendationsChange={setViewportRecommendations}
        />
        <MapSetup hidden={ready} />
      </div>
      <CloudTimeline />
    </section>
  );
}
