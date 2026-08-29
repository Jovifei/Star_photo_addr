"use client";

import { useCallback, useMemo, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { buildPlannerHref } from "@/lib/utils";
import { sameLocationIdentity } from "@/lib/locationIdentity";
import type { CityCandidate } from "@/lib/types";
import ObservationDetails from "@/components/ObservationDetails";
import DecisionBrief from "@/components/DecisionBrief";
import CandidateList from "@/components/CandidateList";
import DetailRestore from "@/components/DetailRestore";
import StarWindowTable from "@/components/StarWindowTable";
import type { SidePanelWidthControls } from "@/components/useSidePanelWidth";
import { DEFAULT_PANEL_WIDTH, MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from "@/components/useSidePanelWidth";

/**
 * Observation detail drawer + star window table + candidate list.
 *
 * v2: The old horizontal-scrolling night-button strip has been replaced by
 * the StarWindowTable component (multi-location × multi-date scoring table
 * with sorting and add/delete).
 */
export default function SidePanel({ widthControls }: { widthControls: SidePanelWidthControls }) {
  const { state, sampleAt, addCandidate, setDetailOpen, removeCandidate } =
    useStore();
  const router = useRouter();
  const { isMobile, width, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture, onResizeKeyDown, resetWidth } = widthControls;
  const candidateStatus = state.candidates.length ? "ok" : "empty";

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

  // "候选到观星计划跟踪"：带地点与观测夜跳转到 /planner，planner 会在挂载时
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
          model: state.cloudState.model,
          forecastTime: state.cloudState.activeForecastTime,
          observationTime: state.cloudState.activeObservationTime,
          overlayMode: state.cloudState.overlayMode,
        }),
      );
    },
    [
      router,
      state.cloudState.activeForecastTime,
      state.cloudState.activeObservationTime,
      state.cloudState.model,
      state.cloudState.overlayMode,
      state.selectedNight,
    ],
  );

  return (
    <div
      className={`detail-overlay-host ${state.detailOpen ? "is-open" : "is-closed"}`}
      style={{} as CSSProperties}
    >
      {!isMobile && (
        <div className="side-panel-rail" aria-label="观测详情面板控制">
          <div
            className="side-panel-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="拖动调整侧边栏宽度"
            aria-valuemin={MIN_PANEL_WIDTH}
            aria-valuemax={MAX_PANEL_WIDTH}
            aria-valuenow={width ?? DEFAULT_PANEL_WIDTH}
            aria-valuetext={`${width ?? DEFAULT_PANEL_WIDTH}px，使用左右方向键调整，回车恢复默认宽度`}
            tabIndex={0}
            data-testid="side-panel-resizer"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onLostPointerCapture={onLostPointerCapture}
            onKeyDown={onResizeKeyDown}
            onDoubleClick={resetWidth}
          />
          <DetailRestore
            open={state.detailOpen}
            label={state.selectedLocation?.name ?? "未选"}
            onToggle={() => setDetailOpen(!state.detailOpen)}
          />
        </div>
      )}
      <aside className="side-panel" style={{ transform }}>
        {state.selectedLocation ? (
          <>
            <ObservationDetails
              sample={state.sample}
              evaluation={evaluation}
              location={state.selectedLocation}
              isCandidate={Boolean(
                state.selectedLocation &&
                  state.candidates.some((candidate) =>
                    sameLocationIdentity(candidate, state.selectedLocation),
                  ),
              )}
              onAddCandidate={state.selectedLocation ? () => addCandidate(state.selectedLocation as NonNullable<typeof state.selectedLocation>) : undefined}
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

      {isMobile && (
        <DetailRestore
          open={state.detailOpen}
          label={state.selectedLocation?.name ?? "未选"}
          onToggle={() => setDetailOpen(!state.detailOpen)}
        />
      )}
    </div>
  );
}
