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
import { evaluateNight, statusMeta } from "@/lib/scoring";
import { formatNightLabel } from "@/lib/nighttime";
import { buildPlannerHref } from "@/lib/utils";

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
  const { state, selectLocation, sampleAt, selectNight } = useStore();
  const router = useRouter();
  const [manualSelectedRecId, setManualSelectedRecId] = useState<string | null>(null);
  const bridgedRecId = useMemo(() => {
    if (!state.selectedLocation) return null;
    const nearest = [...RECOMMENDATIONS]
      .map((rec) => ({
        rec,
        distance: Math.hypot(
          rec.latitude - state.selectedLocation!.latitude,
          rec.longitude - state.selectedLocation!.longitude,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
    return nearest && nearest.distance <= 0.5 ? nearest.rec.id : null;
  }, [state.selectedLocation]);
  const selectedRecId = manualSelectedRecId ?? bridgedRecId;

  // Compute stargazing info from the same forecast/scoring engine used by 逐星.
  const selectedRec = useMemo(
    () => RECOMMENDATIONS.find((r) => r.id === selectedRecId) ?? null,
    [selectedRecId],
  );

  const evaluation = useMemo(() => {
    if (!selectedRec || !state.forecast) return null;
    const location = {
      id: selectedRec.id,
      name: selectedRec.name,
      latitude: selectedRec.latitude,
      longitude: selectedRec.longitude,
      elevation: selectedRec.elevation,
      source: "参考点位" as const,
    };
    const leadIndex = Math.max(0, state.nightKeys.indexOf(state.selectedNight));
    return evaluateNight(
      state.forecast,
      location,
      state.selectedNight,
      leadIndex,
    );
  }, [selectedRec, state.forecast, state.nightKeys, state.selectedNight]);

  const bestHour = useMemo(() => {
    if (!evaluation) return null;
    return (
      evaluation.window[0] ??
      [...evaluation.hours].sort((a, b) => b.score - a.score)[0] ??
      null
    );
  }, [evaluation]);

  const handlePickRecommendation = (recId: string) => {
    setManualSelectedRecId(recId);
    const rec = RECOMMENDATIONS.find((r) => r.id === recId);
    if (rec && mapRef.current) {
      mapRef.current.setView([rec.latitude, rec.longitude], 8, {
        animate: true,
      });
    }
    if (rec) {
      void selectLocation({
        id: rec.id,
        name: rec.name,
        latitude: rec.latitude,
        longitude: rec.longitude,
        elevation: rec.elevation,
        source: "参考点位",
        bortle: rec.bortle,
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
              <RecommendationMarker
                key={rec.id}
                recommendation={rec}
                onSelect={() => handlePickRecommendation(rec.id)}
              />
            ))}
          </MapCanvas>
        </section>

        <aside className="viirs-side-panel">
          <div className="panel-section">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">观星地点</span>
                <h3>推荐观星地点</h3>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {RECOMMENDATIONS.length} 个地点
              </span>
            </div>
            <div className="candidate-list" style={{ marginTop: 8 }}>
              {RECOMMENDATIONS.map((rec) => (
                <button
                  type="button"
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
                </button>
              ))}
            </div>
          </div>

          {selectedRec && (
            <div className="panel-section viirs-astro-info">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">今晚观星条件</span>
                  <h3>{selectedRec.name}</h3>
                </div>
                <span className="bortle-chip">B{selectedRec.bortle}</span>
              </div>
              <label className="sites-night-picker">
                <span>观测夜（以傍晚日期命名）</span>
                <select
                  value={state.selectedNight}
                  onChange={(event) => selectNight(event.target.value)}
                >
                  {state.nightKeys.map((night) => (
                    <option key={night} value={night}>
                      {formatNightLabel(night, false)}
                    </option>
                  ))}
                </select>
              </label>
              {state.loading && (
                <p className="sites-loading" role="status">
                  正在读取该地点天气与观星窗口…
                </p>
              )}
              {evaluation && bestHour && (
                <div className="sites-window-summary">
                  <div>
                    <span>最佳连续观星时间</span>
                    <strong>{evaluation.windowLabel}</strong>
                  </div>
                  <span className={`status-pill ${statusMeta(evaluation.status).tone}`}>
                    {statusMeta(evaluation.status).label} · {evaluation.score}分
                  </span>
                </div>
              )}
              <div className="metric-grid">
                <div className="metric">
                  <div className="label">最佳时段云量</div>
                  <div className="value">
                    {bestHour ? Math.round(bestHour.cloudCover ?? 0) : "—"}<small>%</small>
                  </div>
                </div>
                <div className="metric">
                  <div className="label">月面照度</div>
                  <div className="value">
                    {evaluation ? Math.round(evaluation.moonIllumination * 100) : "—"}<small>%</small>
                  </div>
                </div>
                <div className="metric">
                  <div className="label">银河核心</div>
                  <div className="value">
                    {evaluation?.galacticMax ?? "—"}°<small>最高高度</small>
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
              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  gap: 8,
                }}
              >
                <a
                  className="recommendation-card-button"
                  href={buildPlannerHref({
                    latitude: selectedRec.latitude,
                    longitude: selectedRec.longitude,
                    name: selectedRec.name,
                    elevation: selectedRec.elevation,
                    night: state.selectedNight,
                  })}
                  style={{ flex: 1, textDecoration: "none", textAlign: "center" }}
                >
                  在星野决策中跟踪 ↗
                </a>
                <button
                  type="button"
                  className="recommendation-card-button"
                  onClick={handleNavigateToMain}
                  style={{ flex: 1 }}
                >
                  前往逐星深度分析 →
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      <div id="data-sources">
        <ViirsDocCollapse />
      </div>
    </div>
  );
}
