"use client";

import L from "leaflet";
import { Marker, Tooltip, useMap } from "react-leaflet";
import { useStore } from "@/lib/store";
import {
  observingSiteToLocation,
  recommendationColor,
} from "@/lib/observingSites";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";

function rankIcon(item: ViewportRecommendation, selected: boolean): L.DivIcon {
  const color = recommendationColor(item.score?.band ?? "unknown");
  return L.divIcon({
    className: "viewport-rank-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<span class="viewport-rank-marker-dot" style="--viewport-rank-color:${color};--viewport-rank-scale:${selected ? "1.16" : "1"}"><b>${item.rank}</b></span>`,
  });
}

export default function ViewportRecommendationMarkers({
  recommendations,
}: {
  recommendations: ViewportRecommendation[];
}) {
  const map = useMap();
  const { state, selectLocation, setDetailOpen } = useStore();

  return (
    <>
      {recommendations.map((item) => {
        const selected = state.selectedLocation?.id === item.site.id;
        return (
          <Marker
            key={`viewport-rank-${item.site.id}`}
            position={[item.site.latitude, item.site.longitude]}
            icon={rankIcon(item, selected)}
            zIndexOffset={900 + (recommendations.length - item.rank)}
            title={`${item.rank}. ${item.site.name}`}
            eventHandlers={{
              click: () => {
                void selectLocation(observingSiteToLocation(item.site));
                setDetailOpen(true);
                map.flyTo(
                  [item.site.latitude, item.site.longitude],
                  Math.max(8, map.getZoom()),
                  { duration: 0.45 },
                );
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -14]} opacity={0.96}>
              <span className="viewport-rank-tooltip">
                <b>{item.rank}. {item.site.name}</b>
                <small>
                  {item.score?.score == null ? "等待评分" : `观星分 ${item.score.score}`}
                  {" · "}B{item.site.bortle}
                </small>
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
