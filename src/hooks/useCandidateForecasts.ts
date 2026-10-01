"use client";

import { useEffect, useRef } from "react";
import { requestCandidateForecastBatch } from "@/lib/candidateForecastClient";
import { cachedForecast, useStore } from "@/lib/store";

/** Both views may mount; they share one request owner per model/coordinate/day key. */
export function useCandidateForecasts(locations: Array<{ id: string; latitude: number; longitude: number }>): void {
  const { state, cacheForecast } = useStore();
  const model = state.candidateForecastModel;
  const revision = state.dataRefreshRevision;
  const cacheRef = useRef(state.forecastCache);
  useEffect(() => { cacheRef.current = state.forecastCache; }, [state.forecastCache]);
  // Semantic dependency, NOT forecastCache. Each cache write must not relaunch pending requests.
  const locationsKey = JSON.stringify(locations.map(({ id, latitude, longitude }) => ({ id, latitude, longitude })).sort((a, b) => a.id.localeCompare(b.id)));
  useEffect(() => {
    let active = true;
    const requested = JSON.parse(locationsKey) as Array<{ id: string; latitude: number; longitude: number }>;
    const maxLocationsPerRequest = 64;
    for (let offset = 0; offset < requested.length; offset += maxLocationsPerRequest) {
      const batch = requested.slice(offset, offset + maxLocationsPerRequest);
      void requestCandidateForecastBatch(batch, model, 14, revision).then((results) => {
        if (active) for (const result of results) cacheForecast(result.id, result.forecast);
      }).catch(() => {
        // A failed batch invalidates only its members; old scores cannot survive a failed refresh.
        for (const location of batch) {
          const previous = cachedForecast(cacheRef.current, location.id, model);
          if (active && previous?.metadata?.model === model) cacheForecast(location.id, {
            ...previous, metadata: { ...previous.metadata, stale: true },
          });
        }
      });
    }
    return () => { active = false; };
  }, [locationsKey, model, revision, cacheForecast]);
}
