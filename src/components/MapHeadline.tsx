"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatNightLabel } from "@/lib/nighttime";
import { upcomingAstronomyEvents } from "@/lib/astronomyEvents";
import { useStore } from "@/lib/store";

/**
 * Give the two map workspaces distinct jobs even though they share one map
 * engine. useSearchParams must sit behind a Suspense boundary for static
 * prerendering; the fallback renders the default (tonight) headline so the
 * shell never flashes empty.
 */
function HeadlineBody({ darkSkyWorkspace }: { darkSkyWorkspace: boolean }) {
  const { state } = useStore();
  const events = upcomingAstronomyEvents();
  const primaryEvent = events[0];

  return (
    <div className="map-headline" data-workspace={darkSkyWorkspace ? "sites" : "tonight"}>
      <span>
        {darkSkyWorkspace
          ? "暗夜选址 · 长期暗空基础"
          : `今夜观测 · ${formatNightLabel(state.selectedNight, true)}`}
      </span>
      <h1>
        {darkSkyWorkspace ? "寻找更暗的长期机位" : "今晚云量变化"}
      </h1>
      <p>
        {darkSkyWorkspace
          ? "VIIRS 夜光 · Bortle / 海拔 · 当前视野推荐"
          : "当前状态 → 次日 05:00 · 逐小时预报"}
      </p>
      <small>
        <i />
        {darkSkyWorkspace
          ? "先比较暗夜本底，再叠加今晚天气与出行条件"
          : "当地天气 · 卫星观测 · 任意地点取样"}
      </small>
      {!darkSkyWorkspace && primaryEvent && (
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

function WorkspaceAwareHeadline() {
  const searchParams = useSearchParams();
  return <HeadlineBody darkSkyWorkspace={searchParams.get("panel") === "sites"} />;
}

export default function MapHeadline() {
  return (
    <Suspense fallback={<HeadlineBody darkSkyWorkspace={false} />}>
      <WorkspaceAwareHeadline />
    </Suspense>
  );
}
