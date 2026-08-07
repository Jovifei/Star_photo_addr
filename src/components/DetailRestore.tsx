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
      className={`detail-restore${open ? "" : " visible"}`}
      onClick={onToggle}
    >
      {open ? "收起" : `观测详情 · ${label}`}
    </button>
  );
}
