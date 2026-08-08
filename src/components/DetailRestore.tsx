"use client";

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
      {open ? "收起" : `观测详情 · ${label}`}
    </button>
  );
}
