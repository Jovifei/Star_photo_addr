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
      <div className="headline-capsule">
        <span className="live-status-dot" aria-hidden="true" />
        <span className="headline-mode">
          {darkSkyWorkspace ? "暗夜选址" : "今晚云量"}
        </span>
        <span className="headline-sep">·</span>
        <span className="headline-meta">
          {darkSkyWorkspace ? "长期暗空本底" : formatNightLabel(state.selectedNight, true)}
        </span>
      </div>

      {!darkSkyWorkspace && primaryEvent && (
        <details className="headline-event-dropdown">
          <summary className="headline-event-trigger">
            <span className="event-star">✦</span>
            <span className="event-trigger-text">{primaryEvent.title}</span>
            <span className="event-trigger-date">{primaryEvent.dateLabel}</span>
          </summary>
          <div className="headline-event-popover">
            <div className="popover-title">近期天文事件</div>
            <div className="popover-primary">
              <strong>{primaryEvent.title}</strong>
              <span>{primaryEvent.dateLabel}</span>
            </div>
            {events.slice(1).map((event) => (
              <div key={event.id} className="popover-row">
                <span>{event.title}</span>
                <small>{event.dateLabel}</small>
              </div>
            ))}
          </div>
        </details>
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
