"use client";

import { formatNightLabel } from "@/lib/nighttime";
import { upcomingAstronomyEvents } from "@/lib/astronomyEvents";
import { useStore } from "@/lib/store";

export default function MapHeadline() {
  const { state } = useStore();
  const events = upcomingAstronomyEvents();
  const primaryEvent = events[0];

  return (
    <div className="map-headline">
      <span>今晚观测 · {formatNightLabel(state.selectedNight, true)}</span>
      <h1>今晚云量变化</h1>
      <p>当前状态 → 次日 05:00 · 逐小时预报</p>
      <small>
        <i />
        当地天气 · 卫星观测 · 任意地点取样
      </small>
      {primaryEvent && (
        <div className="astronomy-events" aria-label="最新天文事件">
          <div className="astronomy-event-primary">
            <span>最新天文事件</span>
            <strong>{primaryEvent.title}</strong>
            <em>{primaryEvent.dateLabel}</em>
          </div>
          <div className="astronomy-event-list">
            {events.slice(1).map((event) => (
              <div key={event.id} className="astronomy-event-row">
                <b>{event.title}</b>
                <span>{event.dateLabel}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
