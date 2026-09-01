"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { buildProductHref } from "@/lib/productRoutes";

/** Prerender skeleton: same four entries so header width never jumps. */
export function NavTabsFallback() {
  return (
    <nav className="nav-tabs" aria-label="页面导航">
      {["今夜观测", "暗夜选址", "观星计划", "火烧云"].map((label, index) => (
        <Link
          key={label}
          href={index === 0 ? "/" : "#"}
          className={`nav-tab${index === 0 ? " active" : ""}`}
          aria-current={index === 0 ? "page" : undefined}
        >
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

/** Shared navigation with explicit workspace purpose, not three look-alike labels. */
export default function NavTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state } = useStore();
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

  const tabs = [
    {
      id: "map",
      href: homeHref,
      label: "今夜观测",
      hint: "天气与窗口",
      active: pathname === "/" && !recommendationActive,
    },
    {
      id: "sites",
      href: sitesHref,
      label: "暗夜选址",
      hint: "长期暗空",
      active: recommendationActive,
    },
    {
      id: "planner",
      href: plannerHref,
      label: "观星计划",
      hint: "附近排行",
      active: pathname === "/planner",
    },
    {
      id: "fireglow",
      href: "/fireglow",
      label: "火烧云",
      hint: "晨晚霞窗口",
      active: pathname === "/fireglow",
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
          title={`${tab.label}：${tab.hint}`}
        >
          <span>{tab.label}</span>
          <small className="nav-tab-hint">{tab.hint}</small>
        </Link>
      ))}
    </nav>
  );
}
