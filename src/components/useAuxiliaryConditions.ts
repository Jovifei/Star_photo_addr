"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  nearestAirQualityValue,
  nearestKpValue,
  parseAirQualityPoints,
  parseKpPoints,
  type AirQualityPoint,
  type KpPoint,
} from "@/lib/auxiliaryConditions";
import { parseProviderTime } from "@/lib/nighttime";
import type { Location } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 20_000;
const AIR_QUALITY_DAYS = 4;

interface AirQualitySnapshot {
  locationKey: string;
  points: AirQualityPoint[];
}

interface UseAuxiliaryConditionsInput {
  location: Location | null;
  targetTime: string | null | undefined;
  utcOffsetSeconds: number;
  refreshRevision: number;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    cache: url.includes("refresh=1") ? "no-store" : "default",
    headers: { Accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `辅助数据接口返回 HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

/**
 * Load AQI per location and Kp globally. Timeline playback only reselects the
 * nearest values from downloaded series; it never refetches on every slider
 * tick. Each provider has its own request/error boundary, so an AQI outage does
 * not erase a usable Kp result (and vice versa).
 */
export function useAuxiliaryConditions({
  location,
  targetTime,
  utcOffsetSeconds,
  refreshRevision,
}: UseAuxiliaryConditionsInput): {
  aqiValue: number | null;
  kpValue: number | null;
} {
  const [airQuality, setAirQuality] = useState<AirQualitySnapshot>({
    locationKey: "",
    points: [],
  });
  const [kpPoints, setKpPoints] = useState<KpPoint[]>([]);
  const airRequestRef = useRef<AbortController | null>(null);
  const kpRequestRef = useRef<AbortController | null>(null);
  const lastAirRefreshRevisionRef = useRef(0);
  const lastKpRefreshRevisionRef = useRef(0);

  const latitude = location?.latitude ?? null;
  const longitude = location?.longitude ?? null;
  const locationKey =
    latitude === null || longitude === null
      ? ""
      : `${latitude.toFixed(5)}|${longitude.toFixed(5)}`;

  useEffect(() => {
    if (latitude === null || longitude === null || !locationKey) {
      airRequestRef.current?.abort();
      airRequestRef.current = null;
      return;
    }

    const forceRefresh =
      refreshRevision > 0 &&
      refreshRevision !== lastAirRefreshRevisionRef.current;
    if (forceRefresh) {
      lastAirRefreshRevisionRef.current = refreshRevision;
    }

    airRequestRef.current?.abort();
    const controller = new AbortController();
    airRequestRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    const params = new URLSearchParams({
      lat: String(latitude),
      lng: String(longitude),
      days: String(AIR_QUALITY_DAYS),
    });
    if (forceRefresh) params.set("refresh", "1");

    void fetchJson(
      `/api/air-quality?${params.toString()}`,
      controller.signal,
    )
      .then((payload) => {
        if (controller.signal.aborted || airRequestRef.current !== controller) {
          return;
        }
        setAirQuality({
          locationKey,
          points: parseAirQualityPoints(payload),
        });
      })
      .catch(() => {
        // Preserve the previous series for the same location. A different
        // location never displays it because locationKey must match below.
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (airRequestRef.current === controller) {
          airRequestRef.current = null;
        }
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      if (airRequestRef.current === controller) {
        airRequestRef.current = null;
      }
    };
  }, [latitude, locationKey, longitude, refreshRevision]);

  useEffect(() => {
    const forceRefresh =
      refreshRevision > 0 &&
      refreshRevision !== lastKpRefreshRevisionRef.current;
    if (forceRefresh) {
      lastKpRefreshRevisionRef.current = refreshRevision;
    }

    kpRequestRef.current?.abort();
    const controller = new AbortController();
    kpRequestRef.current = controller;
    const timeout = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    const params = new URLSearchParams();
    if (forceRefresh) params.set("refresh", "1");
    const query = params.toString();

    void fetchJson(
      `/api/space-weather/kp${query ? `?${query}` : ""}`,
      controller.signal,
    )
      .then((payload) => {
        if (controller.signal.aborted || kpRequestRef.current !== controller) {
          return;
        }
        setKpPoints(parseKpPoints(payload));
      })
      .catch(() => {
        // Keep the last global Kp series when a refresh fails.
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (kpRequestRef.current === controller) {
          kpRequestRef.current = null;
        }
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      if (kpRequestRef.current === controller) {
        kpRequestRef.current = null;
      }
    };
  }, [refreshRevision]);

  return useMemo(() => {
    const targetInstant = targetTime
      ? parseProviderTime(targetTime, utcOffsetSeconds).getTime()
      : Date.now();
    return {
      aqiValue:
        locationKey && airQuality.locationKey === locationKey
          ? nearestAirQualityValue(airQuality.points, targetTime)
          : null,
      kpValue: nearestKpValue(kpPoints, targetInstant),
    };
  }, [
    airQuality,
    kpPoints,
    locationKey,
    targetTime,
    utcOffsetSeconds,
  ]);
}
