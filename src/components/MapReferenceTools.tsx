"use client";

import type { Map as LeafletMap } from "leaflet";
import type { RefObject } from "react";
import MapBoundaryStatus from "@/components/MapBoundaryStatus";
import MapLegend from "@/components/MapLegend";
import MapViewActions from "@/components/MapViewActions";

/**
 * Low-frequency map reference controls. This wrapper owns disclosure and
 * composition only; map/data state remains owned by the child components.
 */
export default function MapReferenceTools({
  mapRef,
}: {
  mapRef: RefObject<LeafletMap | null>;
}) {
  return (
    <details className="map-reference-tools">
      <summary>地图说明与视图</summary>
      <div className="map-reference-tools-body">
        <MapLegend />
        <MapViewActions mapRef={mapRef} />
        <MapBoundaryStatus />
      </div>
    </details>
  );
}
