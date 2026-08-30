"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import MapLegend from "@/components/MapLegend";
import MapViewActions from "@/components/MapViewActions";
import MapPanelManager from "@/components/MapPanelManager";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";
import DecisionSummary from "@/components/workspace/DecisionSummary";
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
  const { state, addCandidate } = useStore();
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

  return (
    <>
      <DecisionSummary onJumpToEvidence={onJumpToEvidence} />
      {state.selectedLocation ? (
        <ObservationDetails
          sample={state.sample}
          evaluation={evaluation}
          location={state.selectedLocation}
          isCandidate={state.candidates.some((candidate) =>
            sameLocationIdentity(candidate, state.selectedLocation),
          )}
          onAddCandidate={() => addCandidate(state.selectedLocation!)}
        />
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
  const [tab, setTab] = useState<InspectorTabId>("summary");
  const [viewportRecommendations, setViewportRecommendations] = useState<
    ViewportRecommendation[]
  >([]);

  useEffect(() => {
    if (state.selectedLocation) setTab("summary");
  }, [state.selectedLocation?.id]);

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
      activeTab={tab}
      onTabChange={setTab}
      input={
        <>
          <MapSearchCard />
          <CandidateList
            candidates={state.candidates}
            status={state.candidates.length ? "ok" : "empty"}
            activeId={state.selectedLocation?.id}
            onPick={(candidate) =>
              void sampleAt(candidate.latitude, candidate.longitude, 0, candidate.name)
            }
            onRemove={removeCandidate}
            onTrack={handleTrack}
          />
        </>
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
            summaryPane={<TonightEvidence />}
          />
        </>
      }
      inspectorPanes={{
        summary: evidence,
        places: (
          <>
            <ObservingMapControl docked />
            <BortleControl />
          </>
        ),
        layers: (
          <>
            <MapLegend />
            <MapViewActions mapRef={mapRef} />
            <MapPanelManager />
          </>
        ),
        cloud: <CloudControl />,
        recommendations: (
          <ViewportRecommendationPanel
            mapRef={mapRef}
            ready={ready}
            onRecommendationsChange={setViewportRecommendations}
          />
        ),
      }}
    />
  );
}
