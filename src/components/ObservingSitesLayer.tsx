"use client";

import L from "leaflet";
import { Marker, Tooltip, useMap, type MarkerProps } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  OBSERVING_SITES,
  observingSiteToLocation,
  recommendationColor,
  snapshotScoreAtTime,
} from "@/lib/observingSites";
import { filterSitesByBortleLevels } from "@/lib/bortleFilters";
import { scoreDateForForecastTime } from "@/lib/nighttime";
import { siteBortleColor } from "@/components/BortleFilterBar";
import type { ObservationSnapshot } from "@/lib/types";

function markerIcon(color: string, selected: boolean, bortle: number): L.DivIcon {
  return L.divIcon({
    className: "observing-site-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span class="observing-site-dot" data-bortle="${bortle}" style="--site-color:${color};--site-scale:${selected ? "1.28" : "1"}"></span>`,
  });
}

export function ObservingSiteMarker({ color, selected, bortle, ...props }: Omit<MarkerProps, "icon"> & {
  color: string; selected: boolean; bortle: number;
}) {
  // One icon belongs to this mounted marker. Unrelated grid/store renders
  // keep its DOM intact; actual visual changes replace it. No global cache.
  const icon = useMemo(() => markerIcon(color, selected, bortle), [color, selected, bortle]);
  const markerRef = useRef<L.Marker | null>(null);
  const lastTouch = useRef<number | null>(null);
  useEffect(() => {
    const marker = markerRef.current;
    const element = marker?.getElement();
    if (!marker || !element) return;
    let start: { x: number; y: number } | null = null;
    let dragged = false;
    const down = (event: PointerEvent) => {
      start = event.pointerType === "touch" ? { x: event.clientX, y: event.clientY } : null;
      dragged = false;
    };
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) dragged = true;
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !start || dragged) return;
      start = null;
      lastTouch.current = Date.now();
      // The browser can omit its synthesized click immediately after a sheet
      // touch-drag. Preserve the curated marker's exact identity on pointer-up.
      marker.fire("click", { latlng: marker.getLatLng(), originalEvent: event });
    };
    const click = (event: MouseEvent) => {
      if (event.detail > 0 && lastTouch.current !== null && Date.now() - lastTouch.current < 700) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const cancel = () => { start = null; dragged = false; };
    element.addEventListener("pointerdown", down);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", up);
    element.addEventListener("pointercancel", cancel);
    element.addEventListener("click", click, true);
    return () => {
      element.removeEventListener("pointerdown", down);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", up);
      element.removeEventListener("pointercancel", cancel);
      element.removeEventListener("click", click, true);
    };
  }, [icon]);
  return <Marker {...props} ref={markerRef} icon={icon} />;
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
  const activeForecastTime = state.catalogForecastTime ?? state.cloudState.activeForecastTime;
  const model = state.cloudState.model;
  const selectedNight = state.catalogSelectedNight ?? state.selectedNight;
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

  const filteredSites = useMemo(
    () =>
      filterSitesByBortleLevels(OBSERVING_SITES, state.observingBortleLevels).filter((site) => {
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
      state.observingBortleLevels,
      state.recommendedOnly,
      state.recommendationThreshold,
      state.visibleRecommendationBands,
    ],
  );
  const selectedReferenceSite = useMemo(
    () =>
      state.selectedLocation?.source === "参考点位"
        ? OBSERVING_SITES.find((site) => site.id === state.selectedLocation?.id) ?? null
        : null,
    [state.selectedLocation],
  );
  const visibleSites = useMemo(() => {
    if (
      !selectedReferenceSite ||
      filteredSites.some((site) => site.id === selectedReferenceSite.id)
    ) {
      return filteredSites;
    }
    // Keep the current catalog selection visible without changing the filter
    // result count or the browse set represented by data-observing-site-count.
    return [...filteredSites, selectedReferenceSite];
  }, [filteredSites, selectedReferenceSite]);

  const effectiveSnapshotStatus = activeSnapshot
    ? snapshotStatus
    : snapshotErrorKey === requestKey
      ? "degraded"
      : "loading";

  useEffect(() => {
    const container = map.getContainer();
    container.dataset.observingSiteCount = String(filteredSites.length);
    container.dataset.observingSnapshotStatus = effectiveSnapshotStatus;
  }, [effectiveSnapshotStatus, filteredSites.length, map]);

  return (
    <>
      {visibleSites.map((site) => {
        const score = snapshotScoreAtTime(activeSnapshot, site.id);
        const band = score?.band ?? "unknown";
        const selected = state.selectedLocation?.id === site.id;
        // 选址工作区按目录参考 B1–B4 着色；今夜观测按当前时次评分着色。
        const color =
          state.mapWorkspace === "sites"
            ? siteBortleColor(site.bortle)
            : recommendationColor(band);
        return (
          <ObservingSiteMarker
            key={site.id}
            position={[site.latitude, site.longitude]}
            color={color}
            selected={selected}
            bortle={site.bortle}
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
          </ObservingSiteMarker>
        );
      })}
    </>
  );
}
