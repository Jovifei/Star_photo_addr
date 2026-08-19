"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";

/**
 * Shared product navigation. All three product entry points preserve the
 * current observation session so moving between map, recommendations and the
 * planner does not silently reset the selected location/model/time.
 */
export default function NavTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state } = useStore();
  // Keep the first client render identical to SSR. The store's current-hour
  // snapshot is browser-owned and may tick between server and hydration.
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const navigationState = hydrated ? state : null;

  const plannerParams = new URLSearchParams();
  if (navigationState?.selectedLocation) {
    plannerParams.set("lat", String(navigationState.selectedLocation.latitude));
    plannerParams.set("lng", String(navigationState.selectedLocation.longitude));
    plannerParams.set("name", navigationState.selectedLocation.name);
    plannerParams.set("elevation", String(navigationState.selectedLocation.elevation));
  }
  if (navigationState) {
    plannerParams.set("night", navigationState.selectedNight);
    plannerParams.set("model", navigationState.cloudState.model);
    if (navigationState.cloudState.activeForecastTime) {
      plannerParams.set("forecastTime", navigationState.cloudState.activeForecastTime);
    }
    if (navigationState.cloudState.activeObservationTime) {
      plannerParams.set("observationTime", navigationState.cloudState.activeObservationTime);
    }
    if (navigationState.cloudState.overlayMode) {
      plannerParams.set("overlay", navigationState.cloudState.overlayMode);
    }
  }
  const plannerQuery = plannerParams.toString();
  const plannerHref = plannerQuery ? `/planner?${plannerQuery}` : "/planner";
  const sitesHref = plannerQuery ? `/sites?${plannerQuery}` : "/sites";

  const homeParams = new URLSearchParams();
  if (navigationState?.selectedLocation) {
    homeParams.set("lat", String(navigationState.selectedLocation.latitude));
    homeParams.set("lng", String(navigationState.selectedLocation.longitude));
    homeParams.set("name", navigationState.selectedLocation.name);
    homeParams.set("elevation", String(navigationState.selectedLocation.elevation));
  }
  if (navigationState) {
    homeParams.set("model", navigationState.cloudState.model);
    if (navigationState.cloudState.activeForecastTime) {
      homeParams.set("forecastTime", navigationState.cloudState.activeForecastTime);
    }
    if (navigationState.cloudState.activeObservationTime) {
      homeParams.set("observationTime", navigationState.cloudState.activeObservationTime);
    }
    if (navigationState.cloudState.overlayMode) {
      homeParams.set("overlay", navigationState.cloudState.overlayMode);
    }
  }
  const homeQuery = homeParams.toString();
  const homeHref = homeQuery ? `/?${homeQuery}` : "/";

  const recommendationActive =
    pathname === "/sites" ||
    (pathname === "/" && searchParams.get("panel") === "sites");

  const tabs: Array<{
    id: "map" | "sites" | "planner";
    href: string;
    label: string;
    active: boolean;
  }> = [
    {
      id: "map",
      href: homeHref,
      label: "逐星",
      active: pathname === "/" && !recommendationActive,
    },
    {
      id: "sites",
      href: sitesHref,
      label: "推荐观星地点",
      active: recommendationActive,
    },
    {
      id: "planner",
      href: plannerHref,
      label: "星野决策",
      active: pathname === "/planner",
    },
  ];

  return (
    <nav className="nav-tabs" aria-label="页面导航">
      {tabs.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`nav-tab${tab.active ? " active" : ""}`}
          aria-current={tab.active ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
