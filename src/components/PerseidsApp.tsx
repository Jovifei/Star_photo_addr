"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import TopBar from "@/components/TopBar";
import MapStage from "@/components/MapStage";
import HomeDataSheet from "@/components/HomeDataSheet";
import MapSearchCard from "@/components/MapSearchCard";
import ObservingMapControl from "@/components/ObservingMapControl";
import CandidateList from "@/components/CandidateList";
import ObservationDetails from "@/components/ObservationDetails";
import StarWindowTable from "@/components/StarWindowTable";
import CloudControl from "@/components/CloudControl";
import BortleControl from "@/components/BortleControl";
import MapReferenceTools from "@/components/MapReferenceTools";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";
import DecisionSummary from "@/components/workspace/DecisionSummary";
import ForecastAvailability from "@/components/workspace/ForecastAvailability";
import HourlyForecastMatrix from "@/components/HourlyForecastMatrix";
import MapHeadline from "@/components/MapHeadline";
import HomeContextStrip from "@/components/HomeContextStrip";
import WorkspaceShell from "@/components/workspace/WorkspaceShell";
import { useStore } from "@/lib/store";
import { nightAstronomyFacts } from "@/lib/nightAstronomyFacts";
import { evaluateNight } from "@/lib/scoring";
import { sameLocationIdentity } from "@/lib/locationIdentity";
import LocationDetailCharts from "@/components/LocationDetailCharts";
import type { CityCandidate } from "@/lib/types";
import type { InspectorTabId } from "@/components/workspace/ContextInspector";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";

function TonightEvidence({
  onJumpToEvidence,
  compact = false,
}: {
  onJumpToEvidence?: (tab: InspectorTabId) => void;
  compact?: boolean;
}) {
  const { state, addCandidate, removeCandidate, setCloud } = useStore();
  const leadIndex = Math.max(0, state.nightKeys.indexOf(state.selectedNight));
  const evaluation = useMemo(() => {
    if (
      !state.forecast ||
      state.forecast.metadata?.model !== state.cloudState.model ||
      !state.selectedLocation
    ) return null;
    return evaluateNight(
      state.forecast,
      state.selectedLocation,
      state.selectedNight,
      leadIndex,
    );
  }, [state.cloudState.model, state.forecast, state.selectedLocation, state.selectedNight, leadIndex]);

  const astronomyFacts = useMemo(() => nightAstronomyFacts(state.forecast?.metadata?.model === state.cloudState.model ? state.forecast : null, state.selectedLocation, state.selectedNight), [state.forecast, state.cloudState.model, state.selectedLocation, state.selectedNight]);

  const isCandidate = state.selectedLocation
    ? state.candidates.some((candidate) =>
        sameLocationIdentity(candidate, state.selectedLocation),
    )
    : false;

  const observationDetails = state.selectedLocation ? (
    <ObservationDetails
      sample={state.sample}
      evaluation={evaluation}
      astronomyFacts={astronomyFacts}
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
  ) : null;

  if (compact) return <><DecisionSummary /><ForecastAvailability />{observationDetails}</>;

  return (
    <>
      <DecisionSummary onJumpToEvidence={onJumpToEvidence} />
      <ForecastAvailability />
      {observationDetails}
      {evaluation && evaluation.hours && evaluation.hours.length > 0 && state.selectedLocation ? (
        <LocationDetailCharts
          evaluation={evaluation}
          location={state.selectedLocation}
          nightKey={state.selectedNight}
          activeHour={state.cloudState.activeForecastTime}
          activeEpoch={state.cloudState.activeForecastEpoch}
          onSelectHour={(time, epochSeconds) => setCloud({ activeForecastTime: time, activeForecastEpoch: epochSeconds ?? null })}
          model={state.cloudState.model}
        />
      ) : null}
      {evaluation?.hours && evaluation.hours.length > 0 ? (
        <div className="panel-section" style={{ marginTop: 12 }}>
          <HourlyForecastMatrix
            nightKey={state.selectedNight}
            hours={evaluation.hours}
            selectedTime={state.cloudState.activeForecastTime}
            selectedEpoch={state.cloudState.activeForecastEpoch}
            onSelectTime={(time, epochSeconds) =>
              setCloud({ activeForecastTime: time, activeForecastEpoch: epochSeconds })
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
  const { state, sampleAt, selectCatalogCandidate, removeCandidate } = useStore();
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
      void sampleAt(
        candidate.latitude,
        candidate.longitude,
        candidate.elevation ?? undefined,
        candidate.name,
      );
    },
    [sampleAt],
  );

  const evidence = <TonightEvidence onJumpToEvidence={setTab} />;
  const compactEvidence = <TonightEvidence compact />;
  const candidatePane = <CandidateList
    candidates={state.candidates}
    status={state.candidates.length ? "ok" : "empty"}
    activeId={state.selectedLocation?.id}
    onPick={(candidate) => void selectCatalogCandidate(candidate)}
    onRemove={removeCandidate}
    onTrack={handleTrack}
  />;

  return (
    <WorkspaceShell
      header={<TopBar />}
      commandBar={<MapSearchCard />}
      activeTab={tab}
      onTabChange={setTab}
      input={candidatePane}
      canvas={
        <>
          <MapHeadline />
          <HomeContextStrip />
          <MapStage
            mapRef={mapRef}
            ready={ready}
            onReady={() => setReady(true)}
            viewportRecommendations={viewportRecommendations}
            onRecommendationsChange={setViewportRecommendations}
            summaryPane={evidence}
          />
          <HomeDataSheet candidatePane={candidatePane} compactContent={compactEvidence}>{evidence}</HomeDataSheet>
        </>
      }
      inspectorPanes={{
        summary: evidence,
        settings: (
          <>
            <ObservingMapControl docked />
            <BortleControl />
            <CloudControl />
            <ViewportRecommendationPanel
              mapRef={mapRef}
              ready={ready}
              onRecommendationsChange={setViewportRecommendations}
            />
            <MapReferenceTools mapRef={mapRef} />
          </>
        ),
      }}
    />
  );
}
