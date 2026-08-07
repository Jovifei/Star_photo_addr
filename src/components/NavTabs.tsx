"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation tabs for switching between the "逐星" (main) and "星野决策"
 * (recommendation) pages.
 *
 * The current page is highlighted with an active style. Uses Next.js `<Link>`
 * for client-side navigation.
 */
export default function NavTabs() {
  const pathname = usePathname();

  const tabs: Array<{ href: string; label: string }> = [
    { href: "/", label: "逐星" },
    { href: "/viirs", label: "星野决策" },
  ];

  return (
    <nav className="nav-tabs" aria-label="页面导航">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
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
