"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import {
  fetchCityCandidates,
  selectFeatured,
  type CityCandidateStatus,
} from "@/data/cities";
import type { CityCandidate } from "@/lib/types";
import ObservationDetails from "@/components/ObservationDetails";
import DecisionBrief from "@/components/DecisionBrief";
import CandidateList from "@/components/CandidateList";
import DetailRestore from "@/components/DetailRestore";
import StarWindowTable from "@/components/StarWindowTable";

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

/**
 * Observation detail drawer + star window table + candidate list.
 *
 * v2: The old horizontal-scrolling night-button strip has been replaced by
 * the StarWindowTable component (multi-location × multi-date scoring table
 * with sorting and add/delete).
 */
export default function SidePanel() {
  const { state, setCandidates, sampleAt, setDetailOpen, removeCandidate } =
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

            {/* v2: Star window table replaces the old night-button strip */}
            <StarWindowTable />
          </>
        ) : (
          <div className="panel-section">
            <span className="panel-kicker">观测分析</span>
            <h2 className="panel-location-name">尚未选择地点</h2>
            <p className="panel-coords">
              点击地图任意位置，或搜索城市，开始读取暗夜与天气。
            </p>
          </div>
        )}

        <CandidateList
          candidates={state.candidates}
          status={candidateStatus}
          activeId={state.selectedLocation?.id}
          onPick={handleCandidate}
          onRemove={removeCandidate}
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
