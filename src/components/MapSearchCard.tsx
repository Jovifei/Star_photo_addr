"use client";

import { useCallback, useState } from "react";
import { useStore } from "@/lib/store";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { GeocodeResult } from "@/lib/types";
import SearchCombobox from "@/components/SearchCombobox";
import { resolveElevation } from "@/lib/elevationLookup";
import RecommendationQuickControls from "@/components/RecommendationQuickControls";

/** Search row + top-level location and recommendation controls. */
export default function MapSearchCard() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { sampleAt } = useStore();

  const handlePick = useCallback(
    (result: GeocodeResult) => {
      const elevation = resolveElevation(
        result.latitude,
        result.longitude,
        result.name,
        result.elevation,
      );
      void sampleAt(
        result.latitude,
        result.longitude,
        elevation,
        result.name,
      );
    },
    [sampleAt],
  );


  const onLocated = useCallback(
    (latitude: number, longitude: number) => {
      void sampleAt(latitude, longitude, 0, "我的位置");
    },
    [sampleAt],
  );

  const { loading, error, locate } = useGeolocation(onLocated);

  return (
    <div className="map-search-card">
      <div className="search-only-row">
        <SearchCombobox onPick={handlePick} />
        <button
          type="button"
          className="locate-button"
          aria-label="使用我的当前位置"
          onClick={locate}
          disabled={loading}
        >
          <span aria-hidden="true">⌾</span>
          {loading ? "定位中" : "我的位置"}
        </button>
        <button
          type="button"
          className="mobile-filter-toggle"
          aria-expanded={filtersOpen}
          aria-controls="location-filter-controls"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? "收起筛选" : "时间与地点筛选"}
          <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
        </button>
        <div id="location-filter-controls" className="location-filter-controls" data-open={filtersOpen}>
          <RecommendationQuickControls />
        </div>
      </div>
      {error && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11,
            color: "var(--red)",
            background: "var(--panel)",
            padding: "4px 8px",
            borderRadius: 6,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
