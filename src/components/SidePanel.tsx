"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { buildPlannerHref } from "@/lib/utils";
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

const SIDE_PANEL_WIDTH_KEY = "perseids-side-panel-width-v1";
const MIN_PANEL_WIDTH = 420;
const MAX_PANEL_WIDTH = 920;

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
 * Persisted, drag-resizable side-panel width. On desktop it sets the
 * `--side-panel-width` CSS variable on the host; on mobile the panel is a
 * bottom sheet and width is ignored.
 */
function useResizableWidth(enabled: boolean) {
  // Lazy-init from localStorage on the client (this is a client component).
  // Using an initializer avoids a setState-in-effect cascading render.
  const [width, setWidth] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = Number(localStorage.getItem(SIDE_PANEL_WIDTH_KEY));
      if (Number.isFinite(saved) && saved >= MIN_PANEL_WIDTH) {
        return Math.min(MAX_PANEL_WIDTH, saved);
      }
    } catch {
      // localStorage unavailable — fall back to CSS default.
    }
    return null;
  });
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.style.setProperty(
      "--side-panel-width",
      width ? `${width}px` : "var(--side-panel-width-default)",
    );
  }, [enabled, width]);

  const onDragStart = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled) return;
      event.preventDefault();
      draggingRef.current = true;
      const startX = event.clientX;
      const startWidth =
        width ??
        (document.documentElement.style.getPropertyValue("--side-panel-width")
          ? parseInt(
              document.documentElement.style.getPropertyValue(
                "--side-panel-width",
              ),
              10,
            )
          : 560);

      let liveWidth = startWidth;
      const onMove = (moveEvent: PointerEvent) => {
        if (!draggingRef.current) return;
        // Panel is right-anchored: dragging left (negative deltaX) widens it.
        liveWidth = Math.min(
          MAX_PANEL_WIDTH,
          Math.max(MIN_PANEL_WIDTH, startWidth + (startX - moveEvent.clientX)),
        );
        setWidth(liveWidth);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        try {
          localStorage.setItem(SIDE_PANEL_WIDTH_KEY, String(liveWidth));
        } catch {
          // Ignore quota / private-mode failures.
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [enabled, width],
  );

  return { width, onDragStart };
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
  const router = useRouter();
  const isMobile = useIsMobile();
  const { onDragStart } = useResizableWidth(!isMobile);
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

  // "候选到星野决策跟踪"：带地点与观测夜跳转到 /planner，planner 会在挂载时
  // 把该点加入跟踪点位列表。
  const handleTrack = useCallback(
    (candidate: CityCandidate) => {
      router.push(
        buildPlannerHref({
          latitude: candidate.latitude,
          longitude: candidate.longitude,
          name: candidate.name,
          elevation: 0,
          night: state.selectedNight,
        }),
      );
    },
    [router, state.selectedNight],
  );

  return (
    <div className="detail-overlay-host">
      {!isMobile && (
        <div
          className="side-panel-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整侧边栏宽度"
          onPointerDown={onDragStart}
        />
      )}
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
          onTrack={handleTrack}
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
