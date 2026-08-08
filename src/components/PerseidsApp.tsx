"use client";

import TopBar from "@/components/TopBar";
import MapStage from "@/components/MapStage";
import SidePanel from "@/components/SidePanel";

/**
 * Top-level client shell for the Perseids clone.
 *
 * v2: StoreProvider has been lifted to `layout.tsx` so that both `/` and
 * `/viirs` share the same global state. This component no longer wraps
 * children in a StoreProvider.
 */
export default function PerseidsApp() {
  return (
    <div className="app-shell no-weather-timeline details-closed">
      <TopBar />
      <div className="workspace">
        <MapStage />
        <SidePanel />
      </div>
    </div>
  );
}
