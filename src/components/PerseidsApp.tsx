"use client";

import { StoreProvider } from "@/lib/store";
import TopBar from "@/components/TopBar";
import MapStage from "@/components/MapStage";
import SidePanel from "@/components/SidePanel";

/** Top-level client shell for the Perseids clone. */
export default function PerseidsApp() {
  return (
    <StoreProvider>
      <div className="app-shell no-weather-timeline details-closed">
        <TopBar />
        <div className="workspace">
          <MapStage />
          <SidePanel />
        </div>
      </div>
    </StoreProvider>
  );
}
