"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { GeocodeResult } from "@/lib/types";
import SearchCombobox from "@/components/SearchCombobox";
import { resolveElevation } from "@/lib/elevationLookup";
import RecommendationQuickControls from "@/components/RecommendationQuickControls";

/** Search row + top-level location and recommendation controls. */
export default function MapSearchCard() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const filtersButton = useRef<HTMLButtonElement>(null);
  const { sampleAt } = useStore();

  const handlePick = useCallback(
    (result: GeocodeResult) => {
      const elevation = resolveElevation(
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
      void sampleAt(latitude, longitude, undefined, "我的位置");
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
          {loading ? "定位中" : <>
            <span className="locate-label-full">我的位置</span>
            <span className="locate-label-compact">定位</span>
          </>}
        </button>
        <button
          type="button"
          ref={filtersButton}
          className="mobile-filter-toggle"
          aria-label={filtersOpen ? "收起时间与地点筛选" : "时间与地点筛选"}
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {filtersOpen ? "收起" : "筛选"}
          <span aria-hidden="true">{filtersOpen ? "−" : "+"}</span>
        </button>
        <div id={filtersId} className="location-filter-controls" data-open={filtersOpen}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setFiltersOpen(false);
            filtersButton.current?.focus({ preventScroll: true });
          }}>
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
