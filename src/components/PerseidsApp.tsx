"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap } from "leaflet";
import TopBar from "@/components/TopBar";
import MapStage from "@/components/MapStage";
import MapSearchCard from "@/components/MapSearchCard";
import ObservingMapControl from "@/components/ObservingMapControl";
import CandidateList from "@/components/CandidateList";
import ObservationDetails from "@/components/ObservationDetails";
import StarWindowTable from "@/components/StarWindowTable";
import CloudControl from "@/components/CloudControl";
import BortleControl from "@/components/BortleControl";
import BortleFilterBar from "@/components/BortleFilterBar";
import MapLegend from "@/components/MapLegend";
import MapViewActions from "@/components/MapViewActions";
import MapPanelManager from "@/components/MapPanelManager";
import MapBoundaryStatus from "@/components/MapBoundaryStatus";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";
import DecisionSummary from "@/components/workspace/DecisionSummary";
import ForecastAvailability from "@/components/workspace/ForecastAvailability";
import HourlyForecastMatrix from "@/components/HourlyForecastMatrix";
import MapHeadline from "@/components/MapHeadline";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { sameLocationIdentity } from "@/lib/locationIdentity";
import { buildPlannerHref } from "@/lib/utils";
import type { CityCandidate } from "@/lib/types";
import type { InspectorTabId } from "@/components/workspace/ContextInspector";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";

function TonightEvidence({
  onJumpToEvidence,
}: {
  onJumpToEvidence?: (tab: InspectorTabId) => void;
}) {
  const { state, addCandidate, removeCandidate, setCloud } = useStore();
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

  const isCandidate = state.selectedLocation
    ? state.candidates.some((candidate) =>
        sameLocationIdentity(candidate, state.selectedLocation),
      )
    : false;

  return (
    <>
      <DecisionSummary onJumpToEvidence={onJumpToEvidence} />
      <ForecastAvailability />
      {state.selectedLocation ? (
        <ObservationDetails
          sample={state.sample}
          evaluation={evaluation}
          location={state.selectedLocation}
          isCandidate={isCandidate}
          onAddCandidate={() => addCandidate(state.selectedLocation!)}
          onRemoveCandidate={() => {
            const match = state.candidates.find((c) =>
              sameLocationIdentity(c, state.selectedLocation),
            );
            if (match) removeCandidate(match.id);
          }}
        />
      ) : null}
      {evaluation?.hours && evaluation.hours.length > 0 ? (
        <div className="panel-section" style={{ marginTop: 12 }}>
          <HourlyForecastMatrix
            nightKey={state.selectedNight}
            hours={evaluation.hours}
            selectedTime={state.cloudState.activeForecastTime}
            onSelectTime={(time) =>
              setCloud({ activeForecastTime: time })
            }
            title="逐小时气象与云量详情"
          />
        </div>
      ) : null}
      <StarWindowTable />
    </>
  );
}

export default function PerseidsApp() {
  const { state, sampleAt, removeCandidate } = useStore();
  const router = useRouter();
  const mapRef = useRef<LeafletMap | null>(null);
  const [ready, setReady] = useState(false);
  const selectedLocationId = state.selectedLocation?.id ?? null;
  const [tabState, setTabState] = useState<{
    locationId: string | null;
    tab: InspectorTabId;
  }>(() => ({ locationId: selectedLocationId, tab: "summary" }));
  const tab = tabState.locationId === selectedLocationId
    ? tabState.tab
    : "summary";
  const setTab = useCallback(
    (nextTab: InspectorTabId) => {
      setTabState({ locationId: selectedLocationId, tab: nextTab });
    },
    [selectedLocationId],
  );
  const [viewportRecommendations, setViewportRecommendations] = useState<
    ViewportRecommendation[]
  >([]);

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

  const evidence = <TonightEvidence onJumpToEvidence={setTab} />;

  return (
    <WorkspaceShell
      header={<TopBar />}
      commandBar={<MapSearchCard />}
      activeTab={tab}
      onTabChange={setTab}
      input={
        <CandidateList
          candidates={state.candidates}
          status={state.candidates.length ? "ok" : "empty"}
          activeId={state.selectedLocation?.id}
          onPick={(candidate) =>
            void sampleAt(candidate.latitude, candidate.longitude, candidate.elevation ?? 0, candidate.name)
          }

          onRemove={removeCandidate}
          onTrack={handleTrack}
        />
      }
      canvas={
        <>
          <MapHeadline />
          <MapStage
            mapRef={mapRef}
            ready={ready}
            onReady={() => setReady(true)}
            viewportRecommendations={viewportRecommendations}
            onRecommendationsChange={setViewportRecommendations}
            summaryPane={evidence}
            viewportOverlay={
              state.mapWorkspace === "sites" ? <BortleFilterBar /> : null
            }
          />
        </>
      }
      inspectorPanes={{
        summary: evidence,
        settings: (
          <>
            <ObservingMapControl docked />
            <BortleControl />
            <CloudControl />
            <MapLegend />
            <MapViewActions mapRef={mapRef} />
            <MapPanelManager />
            <MapBoundaryStatus />
            <ViewportRecommendationPanel
              mapRef={mapRef}
              ready={ready}
              onRecommendationsChange={setViewportRecommendations}
            />
          </>
        ),
      }}
    />
  );
}
