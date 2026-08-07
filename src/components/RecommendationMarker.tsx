"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Recommendation } from "@/lib/types";

// Leaflet's module touches `window`/`document`/`navigator` at import (eval)
// time, so a top-level `import "leaflet"` cannot run during server-side
// prerendering. This file is statically imported by `viirs/page.tsx` (a
// "use client" component that Next.js still server-renders for the initial
// HTML), which means a static leaflet import would execute on the server and
// throw "window is not defined", breaking the `/viirs` prerender.
//
// Resolve Leaflet lazily on the client only. This component is only ever
// mounted inside the `ssr: false` MapCanvas, so `getLeaflet()` never runs
// during prerender — yet the icon is still created exactly once via useMemo.
type LeafletModule = typeof import("leaflet");
let cachedLeaflet: LeafletModule | null = null;
function getLeaflet(): LeafletModule {
  if (!cachedLeaflet) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedLeaflet = require("leaflet") as LeafletModule;
  }
  return cachedLeaflet;
}

// Same rationale for react-leaflet: importing it at module top level pulls
// Leaflet (which touches `window`) into the server prerender graph, because
// this file is statically imported by `viirs/page.tsx`. Resolve it lazily so
// the heavy leaflet module is only loaded in the browser.
type ReactLeafletModule = typeof import("react-leaflet");
let cachedReactLeaflet: ReactLeafletModule | null = null;
function getReactLeaflet(): ReactLeafletModule {
  if (!cachedReactLeaflet) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cachedReactLeaflet = require("react-leaflet") as ReactLeafletModule;
  }
  return cachedReactLeaflet;
}

/**
 * A recommendation marker with a popup card.
 *
 * The popup shows the location name, Bortle class chip, recommendation reason,
 * best stargazing season, and a "前往逐星深度分析" button that selects the
 * location in the shared store and navigates to the main page.
 */
export default function RecommendationMarker({
  recommendation,
}: {
  recommendation: Recommendation;
}) {
  const router = useRouter();
  const { selectLocation } = useStore();

  // react-leaflet is resolved lazily (client-only) so its module — and the
  // Leaflet it pulls in — never evaluates during SSR prerendering.
  const { Marker, Popup } = getReactLeaflet();

  // Create a custom star-shaped icon for recommendation markers.
  // Leaflet is resolved lazily (client-only) via getLeaflet(), so no
  // `window`/`document` access happens during SSR prerendering. useMemo
  // ensures the icon is built exactly once.
  const starIcon = useMemo(
    () =>
      getLeaflet().divIcon({
        className: "recommendation-marker",
        html: '<div class="recommendation-marker-dot"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
      }),
    []
  );

  const handleNavigate = () => {
    const location = {
      id: recommendation.id,
      name: recommendation.name,
      latitude: recommendation.latitude,
      longitude: recommendation.longitude,
      elevation: recommendation.elevation,
      source: "参考点位" as const,
      bortle: recommendation.bortle,
    };
    void selectLocation(location).then(() => {
      router.push("/");
    });
  };

  return (
    <Marker
      position={[recommendation.latitude, recommendation.longitude]}
      icon={starIcon}
      zIndexOffset={50}
    >
      <Popup className="recommendation-popup">
        <div className="recommendation-card">
          <div className="recommendation-card-head">
            <strong>{recommendation.name}</strong>
            <span className="bortle-chip">B{recommendation.bortle}</span>
          </div>
          <div className="recommendation-card-meta">
            {recommendation.province} · 海拔 {recommendation.elevation}m
          </div>
          <p className="recommendation-card-reason">{recommendation.reason}</p>
          <div className="recommendation-card-season">
            <span className="recommendation-card-label">最佳季节：</span>
            {recommendation.bestSeason}
          </div>
          {recommendation.galaxyMonths && (
            <div className="recommendation-card-season">
              <span className="recommendation-card-label">银河核心：</span>
              {recommendation.galaxyMonths.join("、")}
            </div>
          )}
          <button
            type="button"
            className="recommendation-card-button"
            onClick={handleNavigate}
          >
            前往逐星深度分析 →
          </button>
        </div>
      </Popup>
    </Marker>
  );
}
