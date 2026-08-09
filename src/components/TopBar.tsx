"use client";

import { useCallback, useState } from "react";
import { Telescope } from "lucide-react";
import EventStatus from "@/components/EventStatus";
import SourcePopover from "@/components/SourcePopover";
import NavTabs from "@/components/NavTabs";

/**
 * Top bar: brand, navigation tabs, live event status, and the data-source
 * entry point.
 *
 * v2: integrates NavTabs for switching between "逐星" and "星野决策" pages.
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
      <NavTabs />
      <EventStatus />
      <button
        type="button"
        className="source-button"
        onClick={() => setSourceOpen(true)}
      >
        数据依据与局限
      </button>
      <SourcePopover open={sourceOpen} onClose={closeSource} />
    </header>
  );
}
