"use client";

import L from "leaflet";
import { Marker, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  OBSERVING_SITES,
  observingSiteToLocation,
  recommendationColor,
  snapshotScoreAtTime,
} from "@/lib/observingSites";
import { scoreDateForForecastTime } from "@/lib/nighttime";
import type { ObservationSnapshot } from "@/lib/types";

function markerIcon(color: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "observing-site-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span class="observing-site-dot" style="--site-color:${color};--site-scale:${selected ? "1.28" : "1"}"></span>`,
  });
}

export default function ObservingSitesLayer() {
  const { state, selectLocation } = useStore();
  const map = useMap();
  const [snapshot, setSnapshot] = useState<ObservationSnapshot | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<
    "loading" | "available" | "degraded"
  >("loading");
  const [snapshotErrorKey, setSnapshotErrorKey] = useState<string | null>(null);
  const snapshotRequestId = useRef(0);
  const lastRefreshRevision = useRef(0);
  const activeForecastTime = state.cloudState.activeForecastTime;
  const model = state.cloudState.model;
  const selectedNight = state.selectedNight;
  const scoreDate = scoreDateForForecastTime(activeForecastTime, selectedNight);
  const requestKey = `${activeForecastTime ?? ""}|${model}|${scoreDate}|${state.dataRefreshRevision}`;

  useEffect(() => {
    const requestId = snapshotRequestId.current + 1;
    snapshotRequestId.current = requestId;
    const controller = new AbortController();
    const forceRefresh =
      state.dataRefreshRevision > 0 &&
      state.dataRefreshRevision !== lastRefreshRevision.current;
    lastRefreshRevision.current = state.dataRefreshRevision;
    const params = new URLSearchParams({
      date: scoreDate,
      days: "1",
      model,
    });
    if (activeForecastTime) params.set("time", activeForecastTime);
    if (forceRefresh) params.set("refresh", "1");
    fetch(`/api/observing/snapshot?${params.toString()}`, {
      signal: controller.signal,
      cache: forceRefresh ? "no-store" : "default",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error ?? "观星快照不可用");
        }
        return payload as ObservationSnapshot;
      })
      .then((payload) => {
        if (
          controller.signal.aborted ||
          requestId !== snapshotRequestId.current
        ) {
          return;
        }
        setSnapshot(payload);
        setSnapshotStatus(payload.stale ? "degraded" : "available");
        setSnapshotErrorKey(null);
      })
      .catch((error) => {
        if (
          error?.name !== "AbortError" &&
          !controller.signal.aborted &&
          requestId === snapshotRequestId.current
        ) {
          setSnapshotStatus("degraded");
          setSnapshotErrorKey(requestKey);
        }
      });
    return () => controller.abort();
  }, [
    activeForecastTime,
    model,
    requestKey,
    scoreDate,
    state.dataRefreshRevision,
  ]);

  const activeSnapshot =
    snapshot !== null &&
    snapshot.date === scoreDate &&
    snapshot.model === model &&
    (activeForecastTime
      ? snapshot.focusTime === activeForecastTime
      : !snapshot.focusTime)
      ? snapshot
      : null;

  const visibleSites = useMemo(
    () =>
      OBSERVING_SITES.filter((site) => {
        if (site.bortle > state.observingBortleLimit) return false;
        const score = snapshotScoreAtTime(activeSnapshot, site.id);
        if (
          state.recommendedOnly &&
          (score?.score == null ||
            score.score < state.recommendationThreshold)
        ) {
          return false;
        }
        if (
          score?.band &&
          score.band !== "unknown" &&
          !state.visibleRecommendationBands.includes(score.band)
        ) {
          return false;
        }
        return true;
      }),
    [
      activeSnapshot,
      state.observingBortleLimit,
      state.recommendedOnly,
      state.recommendationThreshold,
      state.visibleRecommendationBands,
    ],
  );

  const effectiveSnapshotStatus = activeSnapshot
    ? snapshotStatus
    : snapshotErrorKey === requestKey
      ? "degraded"
      : "loading";

  useEffect(() => {
    const container = map.getContainer();
    container.dataset.observingSiteCount = String(visibleSites.length);
    container.dataset.observingSnapshotStatus = effectiveSnapshotStatus;
  }, [effectiveSnapshotStatus, map, visibleSites.length]);

  return (
    <>
      {visibleSites.map((site) => {
        const score = snapshotScoreAtTime(activeSnapshot, site.id);
        const band = score?.band ?? "unknown";
        const selected = state.selectedLocation?.id === site.id;
        return (
          <Marker
            key={site.id}
            position={[site.latitude, site.longitude]}
            icon={markerIcon(recommendationColor(band), selected)}
            title={site.name}
            eventHandlers={{
              click: () => {
                void selectLocation(observingSiteToLocation(site));
                map.flyTo(
                  [site.latitude, site.longitude],
                  Math.max(7, map.getZoom()),
                  { duration: 0.45 },
                );
              },
            }}
          >
            {selected && (
              <Tooltip
                permanent
                direction="top"
                offset={[0, -12]}
                opacity={0.94}
              >
                <span className="observing-site-label">{site.name}</span>
              </Tooltip>
            )}
          </Marker>
        );
      })}
    </>
  );
}
