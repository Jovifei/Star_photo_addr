"use client";

import { METEOR_PEAK_ISO, NIGHT_END, NIGHT_START } from "@/lib/constants";
import { useCountdown } from "@/hooks/useCountdown";

/** Live countdown to the Perseids peak, refreshed every second. */
export default function EventStatus() {
  const countdown = useCountdown(METEOR_PEAK_ISO);
  const text = countdown.passed
    ? "峰值已过 · 仍可观测余迹"
    : countdown.label;

  return (
    <div className="event-status" aria-live="polite">
      <span className="live-dot" />
      <b>当地夜间</b>
      <span>
        {String(NIGHT_START).padStart(2, "0")}:00 — 次日{" "}
        {String(NIGHT_END).padStart(2, "0")}:00
      </span>
      <em>{text}</em>
    </div>
  );
}
