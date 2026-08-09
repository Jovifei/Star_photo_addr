"use client";

import { NIGHT_END, NIGHT_START } from "@/lib/constants";

/** The top bar describes the active local night, not a fixed event date. */
export default function EventStatus() {
  return (
    <div className="event-status" aria-live="polite">
      <span className="live-dot" />
      <b>今晚</b>
      <span>
        {String(NIGHT_START).padStart(2, "0")}:00 — 次日{" "}
        {String(NIGHT_END).padStart(2, "0")}:00
      </span>
      <em>当前 → 未来逐小时云量</em>
    </div>
  );
}
