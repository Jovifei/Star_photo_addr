"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState, useMemo } from "react";
import type { Map as LeafletMap } from "leaflet";
import { useStore } from "@/lib/store";
import TopBar from "@/components/TopBar";
import ViirsDocCollapse from "@/components/ViirsDocCollapse";
import RecommendationMarker from "@/components/RecommendationMarker";
import { RECOMMENDATIONS } from "@/data/recommendations";
import { astronomyAt } from "@/lib/astronomy";

// Leaflet touches `window`, so the map is client-only.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  loading: () => <div className="map-canvas" />,
});

/**
 * 星野决策 · 推荐观星地点 page.
 *
 * Replaces the old static VIIRS documentation page with an interactive
 * recommendation map. Features:
 *   - Full-width map with Chinese label basemap + recommendation markers.
 *   - Side panel listing all recommendations (clickable to focus map).
 *   - Selected location's stargazing time info (sunset, moonset, astro night).
 *   - Collapsible VIIRS documentation at the bottom.
 *
 * Uses the shared StoreProvider (lifted to layout.tsx in T01) so that
 * selecting a recommendation here and navigating to / carries the location
 * over seamlessly.
 */
export default function ViirsPage() {
  const mapRef = useRef<LeafletMap | null>(null);
  const { selectLocation, sampleAt } = useStore();
  const router = useRouter();
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);

  // Compute stargazing info for the selected recommendation.
  const selectedRec = useMemo(
    () => RECOMMENDATIONS.find((r) => r.id === selectedRecId) ?? null,
    [selectedRecId],
  );

  const astroInfo = useMemo(() => {
    if (!selectedRec) return null;
    const now = new Date();
    const location = {
      id: selectedRec.id,
      name: selectedRec.name,
      latitude: selectedRec.latitude,
      longitude: selectedRec.longitude,
      elevation: selectedRec.elevation,
      source: "参考点位" as const,
    };
    // Compute for tonight at 22:00 local time (approximate).
    const tonight = new Date(now);
    tonight.setHours(22, 0, 0, 0);
    const astro = astronomyAt(tonight, location);
    return {
      sunAltitude: Math.round(astro.sunAltitude * 10) / 10,
      moonAltitude: Math.round(astro.moonAltitude * 10) / 10,
      moonIllumination: Math.round(astro.moonIllumination * 100),
      galacticAltitude: Math.round(astro.galacticAltitude * 10) / 10,
    };
  }, [selectedRec]);

  const handlePickRecommendation = (recId: string) => {
    setSelectedRecId(recId);
    const rec = RECOMMENDATIONS.find((r) => r.id === recId);
    if (rec && mapRef.current) {
      mapRef.current.setView([rec.latitude, rec.longitude], 8, {
        animate: true,
      });
    }
  };

  const handleNavigateToMain = () => {
    const rec = RECOMMENDATIONS.find((r) => r.id === selectedRecId);
    if (!rec) return;
    void selectLocation({
      id: rec.id,
      name: rec.name,
      latitude: rec.latitude,
      longitude: rec.longitude,
      elevation: rec.elevation,
      source: "参考点位",
      bortle: rec.bortle,
    }).then(() => {
      router.push("/");
    });
  };

  return (
    <div className="app-shell viirs-page-shell">
      <TopBar />
      <div className="viirs-workspace">
        <section className="viirs-map-stage">
          <MapCanvas
            mapRef={mapRef}
            onSample={(latitude, longitude) => void sampleAt(latitude, longitude)}
            center={[34, 108]}
            zoom={4}
            layers={{ viirs: false, cloud: false, boundaries: true, recommendations: true }}
            recenterOnSelect={false}
          >
            {RECOMMENDATIONS.map((rec) => (
              <RecommendationMarker key={rec.id} recommendation={rec} />
            ))}
          </MapCanvas>
        </section>

        <aside className="viirs-side-panel">
          <div className="panel-section">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">STARGAZING SITES</span>
                <h3>推荐观星地点</h3>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {RECOMMENDATIONS.length} 个地点
              </span>
            </div>
            <div className="candidate-list" style={{ marginTop: 8 }}>
              {RECOMMENDATIONS.map((rec) => (
                <div
                  key={rec.id}
                  className={`candidate-row${selectedRecId === rec.id ? " active" : ""}`}
                  onClick={() => handlePickRecommendation(rec.id)}
                >
                  <div>
                    <div className="name">{rec.name}</div>
                    <div className="meta">
                      {rec.province} · {rec.latitude.toFixed(2)},{" "}
                      {rec.longitude.toFixed(2)}
                    </div>
                  </div>
                  <span className="bortle-chip">B{rec.bortle}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedRec && astroInfo && (
            <div className="panel-section viirs-astro-info">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">STARGAZING TONIGHT</span>
                  <h3>{selectedRec.name}</h3>
                </div>
                <span className="bortle-chip">B{selectedRec.bortle}</span>
              </div>
              <div className="metric-grid">
                <div className="metric">
                  <div className="label">太阳高度</div>
                  <div className="value">
                    {astroInfo.sunAltitude}°<small>地平线下</small>
                  </div>
                </div>
                <div className="metric">
                  <div className="label">月亮高度</div>
                  <div className="value">
                    {astroInfo.moonAltitude}°<small>{astroInfo.moonIllumination}%亮</small>
                  </div>
                </div>
                <div className="metric">
                  <div className="label">银河核心</div>
                  <div className="value">
                    {astroInfo.galacticAltitude}°<small>地平线上</small>
                  </div>
                </div>
                <div className="metric">
                  <div className="label">海拔</div>
                  <div className="value">
                    {selectedRec.elevation}<small>m</small>
                  </div>
                </div>
              </div>
              <p className="panel-reason">{selectedRec.reason}</p>
              <div className="recommendation-card-season">
                <span className="recommendation-card-label">最佳季节：</span>
                {selectedRec.bestSeason}
              </div>
              <button
                type="button"
                className="recommendation-card-button"
                onClick={handleNavigateToMain}
                style={{ marginTop: 12, width: "100%" }}
              >
                前往逐星深度分析 →
              </button>
            </div>
          )}
        </aside>
      </div>

      <ViirsDocCollapse />
    </div>
  );
}
