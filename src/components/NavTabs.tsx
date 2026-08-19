"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { buildProductHref } from "@/lib/productRoutes";

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
  const navigationContext = navigationState
    ? {
        location: navigationState.selectedLocation,
        night: navigationState.selectedNight,
        model: navigationState.cloudState.model,
        forecastTime: navigationState.cloudState.activeForecastTime,
        observationTime: navigationState.cloudState.activeObservationTime,
        overlay: navigationState.cloudState.overlayMode,
      }
    : {};

  const plannerHref = buildProductHref("/planner", navigationContext);
  const sitesHref = buildProductHref("/sites", navigationContext);
  const homeHref = buildProductHref("/", navigationContext, {
    includeNight: false,
  });

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
