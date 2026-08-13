"use client";

import L from "leaflet";
import { Marker, Tooltip, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import {
  OBSERVING_SITES,
  observingSiteToLocation,
  recommendationColor,
} from "@/lib/observingSites";
import type { ObservationSnapshot, RecommendationScore } from "@/lib/types";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function markerIcon(color: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "observing-site-marker",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span class="observing-site-dot" style="--site-color:${color};--site-scale:${selected ? "1.28" : "1"}"></span>`,
  });
}

function snapshotScore(snapshot: ObservationSnapshot | null, id: string): RecommendationScore | null {
  return snapshot?.sites[id]?.[0] ?? null;
}

export default function ObservingSitesLayer() {
  const { state, selectLocation } = useStore();
  const map = useMap();
  const [snapshot, setSnapshot] = useState<ObservationSnapshot | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<"loading" | "available" | "degraded">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      date: state.selectedNight,
      days: "1",
      model: state.cloudState.model,
    });
    fetch(`/api/observing/snapshot?${params.toString()}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "观星快照不可用");
        return payload as ObservationSnapshot;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setSnapshot(payload);
        setSnapshotStatus(payload.stale ? "degraded" : "available");
      })
      .catch((error) => {
        if (error?.name !== "AbortError" && !controller.signal.aborted) {
          setSnapshotStatus("degraded");
        }
      });
    return () => controller.abort();
  }, [state.cloudState.model, state.selectedNight]);

  const visibleSites = useMemo(() => OBSERVING_SITES.filter((site) => {
    if (site.bortle > state.observingBortleLimit) return false;
    const score = snapshotScore(snapshot, site.id);
    if (state.recommendedOnly && (score?.score == null || score.score < state.recommendationThreshold)) return false;
    return true;
  }), [snapshot, state.observingBortleLimit, state.recommendedOnly, state.recommendationThreshold]);

  useEffect(() => {
    map.getContainer().dataset.observingSiteCount = String(visibleSites.length);
    map.getContainer().dataset.observingSnapshotStatus = snapshotStatus;
  }, [map, snapshotStatus, visibleSites.length]);

  return (
    <>
      {visibleSites.map((site) => {
        const score = snapshotScore(snapshot, site.id);
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
                map.flyTo([site.latitude, site.longitude], Math.max(7, map.getZoom()), { duration: 0.45 });
              },
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -12]} opacity={0.94}>
              <span className="observing-site-label">{escapeHtml(site.name)}</span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
