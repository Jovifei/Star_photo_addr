"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import { buildProductHref, type ProductLinkContext } from "@/lib/productRoutes";

/** Prerender skeleton: same four entries so header width never jumps. */
export function NavTabsFallback() {
  return (
    <nav className="nav-tabs" aria-label="页面导航">
      {["今夜观测", "暗夜选址", "火烧云", "云海"].map((label, index) => (
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
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = navRef.current;
    const shell = nav?.closest<HTMLElement>(".app-shell");
    if (!nav || !shell) return;
    // The compact bar can grow when labels wrap or text size changes. Reserve
    // its measured height instead of covering the last data-sheet controls.
    const update = () => shell.style.setProperty("--product-navigation-height", `${Math.ceil(nav.getBoundingClientRect().height)}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--product-navigation-height");
    };
  }, []);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { state } = useStore();
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  const navigationState = hydrated ? state : null;
  const navigationContext: ProductLinkContext = navigationState
    ? {
        location: navigationState.selectedLocation,
        night: navigationState.selectedNight,
        model: navigationState.cloudState.model,
        forecastTime: navigationState.cloudState.activeForecastTime,
        observationTime: navigationState.cloudState.activeObservationTime,
        overlay: navigationState.cloudState.overlayMode,
      }
    : {};

  const sitesHref = buildProductHref("/sites", navigationContext);
  const homeContext: ProductLinkContext = navigationState
    ? {
        ...navigationContext,
        overlay:
          navigationState.cloudState.overlayMode === "night-lights"
            ? "forecast-cloud"
            : navigationState.cloudState.overlayMode,
      }
    : {};
  const homeHref = buildProductHref("/", homeContext, {
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
      id: "fireglow",
      href: "/fireglow",
      label: "火烧云",
      hint: "晨晚霞窗口",
      active: pathname === "/fireglow",
    },
    {
      id: "cloudsea",
      href: "/cloudsea",
      label: "云海",
      hint: "云顶与日出",
      active: pathname === "/cloudsea",
    },
  ];

  return (
    <nav ref={navRef} className="nav-tabs" aria-label="页面导航">
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
