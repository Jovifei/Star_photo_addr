"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import type { CloudOverlayMode } from "@/lib/types";
import { addDays, initialForecastTime } from "@/lib/nighttime";

/**
 * Imports location/night state passed by 星野决策 through the URL.
 *
 * Example:
 * /?lat=30.026&lng=119.007&name=牵牛岗
 */
export default function ProductStateBridge() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { state, selectLocation, selectNight, setCloud } = useStore();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/planner")) return;
    const signature = searchParams.toString();
    if (!signature || applied.current === signature) return;

    const latitudeValue = searchParams.get("lat");
    const longitudeValue = searchParams.get("lng");
    const latitude = latitudeValue === null ? null : Number(latitudeValue);
    const longitude = longitudeValue === null ? null : Number(longitudeValue);
    const name = searchParams.get("name")?.trim() || "星野决策点位";
    // The home map is always tonight-first. Old planner links often carried
    // a seasonal 8/12 night and must not silently move the current map back
    // to that historical event date.
    const isHome = pathname === "/";
    const night = isHome ? null : searchParams.get("night");
    const model = searchParams.get("model");
    const forecastTime = searchParams.get("forecastTime");
    const observationTime = searchParams.get("observationTime");
    const overlay = searchParams.get("overlay") as CloudOverlayMode | null;
    if (isHome && searchParams.has("night")) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("night");
      window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }

    // Home is tonight-first. A copied planner URL may contain a historical
    // forecast hour (for example 8/12) and must not silently move the map away
    // from the current local window. Keep same/adjacent local dates so a valid
    // cross-product handoff around midnight still works.
    const homeForecastTime = initialForecastTime();
    const homeDate = homeForecastTime.slice(0, 10);
    const forecastDate = forecastTime?.slice(0, 10);
    const acceptedHomeDates = new Set([homeDate, addDays(homeDate, -1), addDays(homeDate, 1)]);
    const acceptedHomeForecastTime = !isHome || !forecastTime || acceptedHomeDates.has(forecastDate ?? "")
      ? forecastTime
      : null;
    if (isHome && forecastTime && !acceptedHomeForecastTime) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete("forecastTime");
      window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }

    if (night && state.nightKeys.includes(night)) {
      selectNight(night);
    }
    const selectedModel = model === "icon" || model === "gfs" || model === "aifs" ? model : undefined;
    if (selectedModel) setCloud({ model: selectedModel });
    if (overlay === "satellite-cloud" || overlay === "forecast-cloud" || overlay === "night-lights") {
      setCloud({ overlayMode: overlay });
    }
    if (acceptedHomeForecastTime || observationTime) {
      setCloud({
        activeForecastTime: acceptedHomeForecastTime ?? state.cloudState.activeForecastTime,
        activeObservationTime: observationTime ?? state.cloudState.activeObservationTime,
      });
    }

    if (
      latitude !== null &&
      longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      applied.current = signature;
      void selectLocation({
        id: `planner-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
        name,
        latitude,
        longitude,
        elevation: Number(searchParams.get("elevation")) || 0,
        source: "搜索",
      }, selectedModel);
    }

    // Mark coordinate-less links as handled too. This prevents the bridge
    // effect from retrying a night-only URL forever while, importantly, never
    // manufacturing a 0,0 location from missing query parameters.
    applied.current = signature;
  }, [pathname, searchParams, selectLocation, selectNight, setCloud, state.cloudState.activeForecastTime, state.cloudState.activeObservationTime, state.nightKeys]);

  return null;
}
