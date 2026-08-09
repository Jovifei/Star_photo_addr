"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  const plannerParams = new URLSearchParams();
  if (state.selectedLocation) {
    plannerParams.set("lat", String(state.selectedLocation.latitude));
    plannerParams.set("lng", String(state.selectedLocation.longitude));
    plannerParams.set("name", state.selectedLocation.name);
    plannerParams.set("elevation", String(state.selectedLocation.elevation));
  }
  plannerParams.set("night", state.selectedNight);
  const plannerHref = `/planner?${plannerParams.toString()}`;

  const tabs: Array<{ href: string; label: string }> = [
    { href: "/", label: "逐星" },
    { href: "/sites", label: "推荐观星地点" },
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
