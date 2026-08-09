"use client";

import { useCallback } from "react";
import { useStore } from "@/lib/store";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { GeocodeResult } from "@/lib/types";
import SearchCombobox from "@/components/SearchCombobox";

/** Search row + "我的位置" button. */
export default function MapSearchCard() {
  const { sampleAt } = useStore();

  const handlePick = useCallback(
    (result: GeocodeResult) => {
      void sampleAt(
        result.latitude,
        result.longitude,
        result.elevation ?? 0,
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
