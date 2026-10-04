"use client";

import { useEffect, useRef, useState } from "react";
import { forecastRecoveryDelay } from "@/lib/forecastClient";
import { requestCandidateForecastBatch } from "@/lib/candidateForecastClient";
import { cachedForecast, useStore } from "@/lib/store";

/** Both views may mount; they share one request owner per model/coordinate/day key. */
function safeRequestError(error: unknown): string {
  if (!(error instanceof Error)) return "天气服务暂时不可用";
  if (/天气|HTTP\s*\d{3}|秒后重试/.test(error.message)) return error.message.slice(0, 180);
  if (error.name === "AbortError" || /timeout|超时/i.test(error.message)) return "天气请求超时，请稍后重试";
  return "天气服务暂时不可用，请稍后重试";
}

export function useCandidateForecasts(locations: Array<{ id: string; latitude: number; longitude: number }>): string | null {
  const { state, cacheForecast } = useStore();
  const model = state.candidateForecastModel;
  const revision = state.dataRefreshRevision;
  const [requestFailure, setRequestFailure] = useState<{ key: string; message: string } | null>(null);
  const cacheRef = useRef(state.forecastCache);
  useEffect(() => { cacheRef.current = state.forecastCache; }, [state.forecastCache]);
  // Semantic dependency, NOT forecastCache. Each cache write must not relaunch pending requests.
  const locationsKey = JSON.stringify(locations.map(({ id, latitude, longitude }) => ({ id, latitude, longitude })).sort((a, b) => a.id.localeCompare(b.id)));
  const requestKey = `${model}|${revision}|${locationsKey}`;
  useEffect(() => {
    let active = true;
    const requested = JSON.parse(locationsKey) as Array<{ id: string; latitude: number; longitude: number }>;
    const maxLocationsPerRequest = 64;
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const failures = new Map<number, string>();
    const publishFailure = () => setRequestFailure(failures.size
      ? { key: requestKey, message: failures.values().next().value! }
      : null);
    for (let offset = 0; offset < requested.length; offset += maxLocationsPerRequest) {
      const batch = requested.slice(offset, offset + maxLocationsPerRequest);
      const attempt = (recovery = false) => {
      void requestCandidateForecastBatch(batch, model, 14, revision).then((results) => {
        if (!active) return;
        for (const result of results) cacheForecast(result.id, result.forecast);
        failures.delete(offset);
        publishFailure();
      }).catch((error: unknown) => {
        if (!active) return;
        failures.set(offset, safeRequestError(error));
        publishFailure();
        if (!recovery) timers.push(setTimeout(() => {
          if (active) attempt(true);
        }, forecastRecoveryDelay(batch, model, 14)));
        // A failed batch invalidates only its members; old scores cannot survive a failed refresh.
        for (const location of batch) {
          const previous = cachedForecast(cacheRef.current, location.id, model);
          if (previous?.metadata?.model === model) cacheForecast(location.id, {
            ...previous, metadata: { ...previous.metadata, stale: true },
          });
        }
      });
      };
      attempt();
    }
    return () => { active = false; timers.forEach(clearTimeout); };
  }, [locationsKey, model, revision, requestKey, cacheForecast]);
  return requestFailure?.key === requestKey ? requestFailure.message : null;
}
