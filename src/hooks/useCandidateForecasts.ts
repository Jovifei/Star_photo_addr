"use client";

import { useEffect, useRef } from "react";
import { requestCandidateForecast } from "@/lib/candidateForecastClient";
import { cachedForecast, useStore } from "@/lib/store";

/** Both views may mount; they share one request owner per model/coordinate/day key. */
export function useCandidateForecasts(locations: Array<{ id: string; latitude: number; longitude: number }>): void {
  const { state, cacheForecast } = useStore();
  const model = state.cloudState.model;
  const revision = state.dataRefreshRevision;
  const cacheRef = useRef(state.forecastCache);
  useEffect(() => { cacheRef.current = state.forecastCache; }, [state.forecastCache]);
  // Semantic dependency, NOT forecastCache. Each cache write must not relaunch pending requests.
  const locationsKey = JSON.stringify(locations.map(({ id, latitude, longitude }) => ({ id, latitude, longitude })).sort((a, b) => a.id.localeCompare(b.id)));
  useEffect(() => {
    let active = true;
    const requested = JSON.parse(locationsKey) as Array<{ id: string; latitude: number; longitude: number }>;
    for (const location of requested) {
      void requestCandidateForecast(location, model, 14, revision).then((forecast) => {
        if (active) cacheForecast(location.id, forecast);
      }).catch(() => {
        // A failed refresh must also invalidate an older store entry; it must not keep its high score.
        const previous = cachedForecast(cacheRef.current, location.id, model);
        if (active && previous?.metadata?.model === model) cacheForecast(location.id, {
          ...previous, metadata: { ...previous.metadata, stale: true },
        });
      });
    }
    return () => { active = false; };
  }, [locationsKey, model, revision, cacheForecast]);
}
