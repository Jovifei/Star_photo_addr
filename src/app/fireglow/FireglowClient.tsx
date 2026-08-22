"use client";

import dynamic from "next/dynamic";

// Leaflet owns browser globals; keep it out of server prerendering.
const FireglowApp = dynamic(() => import("./FireglowApp"), {
  ssr: false,
  loading: () => (
    <main className="fireglow-loading" role="status" aria-live="polite">
      正在载入火烧云地图…
    </main>
  ),
});

export default function FireglowClient() {
  return <FireglowApp />;
}
