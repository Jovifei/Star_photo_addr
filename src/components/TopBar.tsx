"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";
import { Info, Telescope } from "lucide-react";
import EventStatus from "@/components/EventStatus";
import SourcePopover from "@/components/SourcePopover";
import NavTabs from "@/components/NavTabs";

function NavTabsFallback() {
  return (
    <nav className="nav-tabs" aria-label="页面导航">
      <Link href="/" className="nav-tab active" aria-current="page">
        逐星
      </Link>
      <Link href="/sites" className="nav-tab">
        推荐观星地点
      </Link>
      <Link href="/planner" className="nav-tab">
        星野决策
      </Link>
    </nav>
  );
}

/**
 * Top bar: one shared brand, three product workspaces, live event status and
 * the data-source disclosure entry point.
 */
export default function TopBar() {
  const [sourceOpen, setSourceOpen] = useState(false);
  const closeSource = useCallback(() => setSourceOpen(false), []);

  return (
    <header className="topbar">
      <div className="brand-block">
        <div className="brand-mark" aria-hidden="true">
          <Telescope size={18} strokeWidth={1.8} />
        </div>
        <div>
          <strong>逐星</strong>
          <span>星空摄影观测平台</span>
        </div>
      </div>
      <Suspense fallback={<NavTabsFallback />}>
        <NavTabs />
      </Suspense>
      <EventStatus />
      <button
        type="button"
        className="source-button"
        aria-label="数据依据与局限"
        aria-haspopup="dialog"
        aria-expanded={sourceOpen}
        aria-controls="source-popover"
        onClick={() => setSourceOpen(true)}
      >
        <Info size={16} strokeWidth={1.9} aria-hidden="true" />
        <span className="source-button-label">数据依据与局限</span>
      </button>
      <SourcePopover open={sourceOpen} onClose={closeSource} />
    </header>
  );
}
