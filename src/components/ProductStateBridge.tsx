"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * Imports location/night state passed by 星野决策 through the URL.
 *
 * Example:
 * /?lat=30.026&lng=119.007&name=牵牛岗&night=2026-08-12
 */
export default function ProductStateBridge() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { state, selectLocation, selectNight } = useStore();
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (pathname.startsWith("/planner")) return;
    const signature = searchParams.toString();
    if (!signature || applied.current === signature) return;

    const latitude = Number(searchParams.get("lat"));
    const longitude = Number(searchParams.get("lng"));
    const name = searchParams.get("name")?.trim() || "星野决策点位";
    const night = searchParams.get("night");

    if (night && state.nightKeys.includes(night)) {
      selectNight(night);
    }

    if (
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
      });
    }
  }, [pathname, searchParams, selectLocation, selectNight, state.nightKeys]);

  return null;
}
