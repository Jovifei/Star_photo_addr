"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { evaluateNight, statusMeta } from "@/lib/scoring";
import {
  fetchCityCandidates,
  selectFeatured,
  type CityCandidateStatus,
} from "@/data/cities";
import { formatNightLabel } from "@/lib/nighttime";
import type { CityCandidate } from "@/lib/types";
import ObservationDetails from "@/components/ObservationDetails";
import DecisionBrief from "@/components/DecisionBrief";
import CandidateList from "@/components/CandidateList";
import DetailRestore from "@/components/DetailRestore";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isMobile;
}

/** Observation detail drawer + candidate list + expand/collapse handle. */
export default function SidePanel() {
  const { state, setCandidates, selectNight, sampleAt, setDetailOpen } =
    useStore();
  const isMobile = useIsMobile();
  const [candidateStatus, setCandidateStatus] =
    useState<CityCandidateStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    void fetchCityCandidates().then((result) => {
      if (cancelled) return;
      setCandidates(selectFeatured(result.candidates, 34));
      setCandidateStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, [setCandidates]);

  const leadIndex = Math.max(0, state.nightKeys.indexOf(state.selectedNight));
  const evaluation = useMemo(() => {
    if (!state.forecast || !state.selectedLocation) return null;
    return evaluateNight(
      state.forecast,
      state.selectedLocation,
      state.selectedNight,
      leadIndex,
    );
  }, [state.forecast, state.selectedLocation, state.selectedNight, leadIndex]);

  const transform = isMobile
    ? state.detailOpen
      ? "translateY(0)"
      : "translateY(100%)"
    : state.detailOpen
      ? "translateX(0)"
      : "translateX(100%)";

  const handleCandidate = (candidate: CityCandidate) => {
    void sampleAt(candidate.latitude, candidate.longitude, 0, candidate.name);
  };

  return (
    <div className="detail-overlay-host">
      <aside className="side-panel" style={{ transform }}>
        {state.selectedLocation ? (
          <>
            <ObservationDetails
              sample={state.sample}
              evaluation={evaluation}
              location={state.selectedLocation}
            />
            <DecisionBrief evaluation={evaluation} />

            <div className="panel-section">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">FORECAST NIGHTS</span>
                  <h3>观测夜</h3>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 10,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {state.nightKeys.map((night, index) => {
                  const nightEval = state.forecast
                    ? evaluateNight(
                        state.forecast,
                        state.selectedLocation as NonNullable<
                          typeof state.selectedLocation
                        >,
                        night,
                        index,
                      )
                    : null;
                  const meta = statusMeta(nightEval?.status ?? "no");
                  const active = night === state.selectedNight;
                  return (
                    <button
                      key={night}
                      type="button"
                      onClick={() => selectNight(night)}
                      style={{
                        flex: "0 0 auto",
                        minWidth: 58,
                        border: `1px solid ${active ? "var(--green)" : "var(--line)"}`,
                        background: active ? "#0c2a33" : "var(--panel-2)",
                        color: active ? "var(--green-soft)" : "var(--text)",
                        borderRadius: 8,
                        padding: "6px 8px",
                        cursor: "pointer",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: 11 }}>
                        {formatNightLabel(night, true)}
                      </div>
                      <div style={{ fontSize: 13, fontFamily: "var(--font-mono)" }}>
                        {nightEval?.score ?? "—"}
                      </div>
                      <small className={meta.tone} style={{ fontSize: 10 }}>
                        {index >= 7 ? "趋势" : meta.label}
                      </small>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="panel-section">
            <span className="panel-kicker">OBSERVATION</span>
            <h2 className="panel-location-name">尚未选择地点</h2>
            <p className="panel-coords">
              点击地图任意位置，或搜索城市，开始读取暗夜与天气。
            </p>
          </div>
        )}

        <CandidateList
          candidates={state.candidates}
          status={candidateStatus}
          onPick={handleCandidate}
        />
      </aside>

      <DetailRestore
        open={state.detailOpen}
        label={state.selectedLocation?.name ?? "未选"}
        onToggle={() => setDetailOpen(!state.detailOpen)}
      />
    </div>
  );
}
