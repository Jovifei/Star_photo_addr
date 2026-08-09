"use client";

import TopBar from "@/components/TopBar";
import MapStage from "@/components/MapStage";
import SidePanel from "@/components/SidePanel";
import { useSidePanelWidth } from "@/components/useSidePanelWidth";
import type { CSSProperties } from "react";

/**
 * Top-level client shell for the Perseids clone.
 *
 * v2: StoreProvider has been lifted to `layout.tsx` so that both `/` and
 * `/viirs` share the same global state. This component no longer wraps
 * children in a StoreProvider.
 */
export default function PerseidsApp() {
  const sidePanel = useSidePanelWidth();

  return (
    <div className="app-shell no-weather-timeline details-closed">
      <TopBar />
      <div
        className="workspace"
        style={sidePanel.width && !sidePanel.isMobile ? { "--side-panel-width-requested": `${sidePanel.width}px` } as CSSProperties : undefined}
      >
        <MapStage />
        <SidePanel widthControls={sidePanel} />
      </div>
    </div>
  );
}
