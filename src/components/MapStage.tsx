"use client";

import dynamic from "next/dynamic";
import type { ReactNode, RefObject } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useStore } from "@/lib/store";
import { describeSamplePoint } from "@/lib/locationPresentation";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";
import MapSetup from "@/components/MapSetup";
import CloudTimeline from "@/components/CloudTimeline";

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

export default function MapStage({
  mapRef,
  ready,
  onReady,
  viewportRecommendations,
  onRecommendationsChange,
  summaryPane = null,
  viewportOverlay = null,
}: {
  mapRef: RefObject<LeafletMap | null>;
  ready: boolean;
  onReady: () => void;
  viewportRecommendations: ViewportRecommendation[];
  onRecommendationsChange: (items: ViewportRecommendation[]) => void;
  summaryPane?: ReactNode;
  /** Workspace-owned floating control pinned over the map (e.g. B1–B4 filter). */
  viewportOverlay?: ReactNode;
}) {
  const { sampleAt } = useStore();

  return (
    <section className="map-stage">
      <div className="map-viewport">
        <MapCanvas
          mapRef={mapRef}
          onReady={onReady}
          onSample={(latitude, longitude) =>
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
        {viewportOverlay}
        <ResponsiveMapControls
          variant="canvas"
          mapRef={mapRef}
          ready={ready}
          onRecommendationsChange={onRecommendationsChange}
          summaryPane={summaryPane}
        />
        <MapSetup hidden={ready} />
      </div>
      <CloudTimeline />
    </section>
  );
}
