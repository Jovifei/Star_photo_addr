"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";

/**
 * Navigation tabs for switching between the "逐星" (main) and "星野决策"
 * (recommendation) pages.
 *
 * The current page is highlighted with an active style. Uses Next.js `<Link>`
 * for client-side navigation.
 */
export default function NavTabs() {
  const pathname = usePathname();
  const { state } = useStore();
  // The store's tonight/current-hour snapshot is intentionally refreshed from
  // the browser. Keep the first client render identical to SSR so a clock tick
  // between those renders cannot change Link href attributes during hydration.
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
    if (navigationState.cloudState.activeForecastTime) plannerParams.set("forecastTime", navigationState.cloudState.activeForecastTime);
    if (navigationState.cloudState.activeObservationTime) plannerParams.set("observationTime", navigationState.cloudState.activeObservationTime);
    if (navigationState.cloudState.overlayMode) plannerParams.set("overlay", navigationState.cloudState.overlayMode);
  }
  const plannerQuery = plannerParams.toString();
  const plannerHref = plannerQuery ? `/planner?${plannerQuery}` : "/planner";

  const homeParams = new URLSearchParams();
  if (navigationState?.selectedLocation) {
    homeParams.set("lat", String(navigationState.selectedLocation.latitude));
    homeParams.set("lng", String(navigationState.selectedLocation.longitude));
    homeParams.set("name", navigationState.selectedLocation.name);
    homeParams.set("elevation", String(navigationState.selectedLocation.elevation));
  }
  if (navigationState) {
    homeParams.set("model", navigationState.cloudState.model);
    if (navigationState.cloudState.activeForecastTime) homeParams.set("forecastTime", navigationState.cloudState.activeForecastTime);
    if (navigationState.cloudState.activeObservationTime) homeParams.set("observationTime", navigationState.cloudState.activeObservationTime);
    if (navigationState.cloudState.overlayMode) homeParams.set("overlay", navigationState.cloudState.overlayMode);
  }
  const homeHref = homeParams.toString() ? `/?${homeParams.toString()}` : "/";

  const tabs: Array<{ href: string; label: string }> = [
    { href: homeHref, label: "逐星" },
    { href: plannerHref, label: "星野决策" },
  ];

  return (
    <nav className="nav-tabs" aria-label="页面导航">
      {tabs.map((tab) => {
        const tabPath = tab.href.split("?")[0];
        const active = pathname === tabPath;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`nav-tab${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
