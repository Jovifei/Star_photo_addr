"use client";

import { NIGHT_END, NIGHT_START } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { formatNightLabel } from "@/lib/nighttime";

/** The top bar describes the active local night, not a fixed event date. */
export default function EventStatus() {
  const { state } = useStore();
  return (
    <div className="event-status" aria-live="polite">
      <span className="live-dot" />
      <b>{formatNightLabel(state.selectedNight, true)}</b>
      <span>
        {String(NIGHT_START).padStart(2, "0")}:00 — 次日{" "}
        {String(NIGHT_END).padStart(2, "0")}:00
      </span>
      <em>当前 → 未来逐小时云量</em>
    </div>
  );
}
