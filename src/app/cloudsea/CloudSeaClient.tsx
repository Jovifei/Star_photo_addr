"use client";

import dynamic from "next/dynamic";

// Leaflet owns browser globals; keep it out of server prerendering.
const CloudSeaApp = dynamic(() => import("./CloudSeaApp"), {
  ssr: false,
  loading: () => (
    <main className="cloudsea-loading" role="status" aria-live="polite">
      正在载入高山云海气象地图…
    </main>
  ),
});

export default function CloudSeaClient() {
  return <CloudSeaApp />;
}
