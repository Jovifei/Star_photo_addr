"use client";

import { useCallback, useState } from "react";
import { Info, Telescope } from "lucide-react";
import EventStatus from "@/components/EventStatus";
import SourcePopover from "@/components/SourcePopover";
import ProductHeader from "@/components/ProductHeader";

/**
 * 今夜观测 workspace header: shared ProductHeader geometry with the map's
 * own data-source disclosure pinned right.
 */
export default function TopBar() {
  const [sourceOpen, setSourceOpen] = useState(false);
  const closeSource = useCallback(() => setSourceOpen(false), []);

  return (
    <ProductHeader
      mark={<Telescope size={18} strokeWidth={1.8} />}
      eyebrow="逐星"
      title="星空摄影观测平台"
    >
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
    </ProductHeader>
  );
}
