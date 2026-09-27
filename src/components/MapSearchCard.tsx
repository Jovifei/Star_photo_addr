"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { GeocodeResult } from "@/lib/types";
import SearchCombobox from "@/components/SearchCombobox";
import { resolveElevation } from "@/lib/elevationLookup";
import RecommendationQuickControls from "@/components/RecommendationQuickControls";
import AdaptiveSheet from "@/components/ui/AdaptiveSheet";
import { useMobilePanelViewport } from "@/components/ResponsiveMapControls";
import { LocateFixed, SlidersHorizontal } from "lucide-react";

/** Search row + top-level location and recommendation controls. */
export default function MapSearchCard() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  const filtersButton = useRef<HTMLButtonElement>(null);
  const mobile = useMobilePanelViewport();
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

  const closeFilters = useCallback(() => {
    setFiltersOpen(false);
  }, []);

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
          <LocateFixed size={18} aria-hidden="true" />
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
          aria-controls={mobile ? "mobile-filter-sheet" : filtersId}
          onClick={() => setFiltersOpen((open) => (mobile ? true : !open))}
        >
          <SlidersHorizontal size={18} aria-hidden="true" />
          <span className="mobile-filter-label">{filtersOpen ? "收起" : "筛选"}</span>
        </button>
        {!mobile ? (
          <div id={filtersId} className="location-filter-controls" data-open={filtersOpen}>
            <RecommendationQuickControls />
          </div>
        ) : null}
      </div>
      {mobile ? (
        <AdaptiveSheet
          open={filtersOpen}
          title="时间与地点筛选"
          id="mobile-filter-sheet"
          onClose={closeFilters}
          triggerRef={filtersButton}
          className="mobile-filter-sheet"
          backdropClassName="mobile-filter-sheet-backdrop"
          bodyClassName="mobile-filter-sheet-body"
          testId="mobile-filter-sheet"
          header={(
            <header className="mobile-filter-sheet-head">
              <div>
                <span>高级筛选</span>
                <strong>时间与地点筛选</strong>
              </div>
              <button type="button" onClick={closeFilters} aria-label="关闭时间与地点筛选">
                关闭
              </button>
            </header>
          )}
        >
          <div className="mobile-filter-sheet-content">
            <RecommendationQuickControls />
          </div>
        </AdaptiveSheet>
      ) : null}
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
