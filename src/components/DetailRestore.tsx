"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Expand / collapse button for the observation detail panel. */
export default function DetailRestore({
  open,
  label,
  onToggle,
}: {
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`detail-restore ${open ? "open" : "visible"}`}
      aria-expanded={open}
      aria-label={open ? "收起观测详情" : `展开观测详情：${label}`}
      onClick={onToggle}
    >
      {open ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
      <span>{open ? "收起" : "详情"}</span>
      <span className="sr-only">{open ? "收起观测详情" : `展开观测详情：${label}`}</span>
    </button>
  );
}
