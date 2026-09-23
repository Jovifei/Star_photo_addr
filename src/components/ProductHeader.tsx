"use client";

import { Suspense, useId, useRef, useState, type ReactNode } from "react";
import NavTabs, { NavTabsFallback } from "@/components/NavTabs";
import ChangelogModal from "@/components/ChangelogModal";
import { APP_VERSION_LABEL } from "@/lib/appVersion";

/**
 * The one header shared by every product workspace. Geometry lives here and
 * only here: brand block end-justified in column 1, the four product tabs
 * exactly centred in column 2, page-specific controls pinned right in
 * column 3. Pages inject their own controls through `children`; they cannot
 * drift the shared geometry anymore. Compact topic headers progressively disclose
 * date/phase controls while retaining their original active values and handlers.
 */
export default function ProductHeader({
  mark,
  markClassName,
  eyebrow,
  title,
  children,
}: {
  mark: ReactNode;
  markClassName?: string;
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const controlsId = useId();
  const controlsButton = useRef<HTMLButtonElement>(null);
  const topicControls = markClassName === "fireglow-mark" || markClassName === "cloudsea-mark";

  return (
    <header className="app-header" data-controls-expanded={controlsExpanded}>
      <div className="app-header-brand">
        <span className={`app-header-mark${markClassName ? ` ${markClassName}` : ""}`} aria-hidden="true">
          {mark}
        </span>
        <div className="app-header-brand-copy">
          <div className="app-header-eyebrow-row">
            <p className="app-header-eyebrow">{eyebrow}</p>
            <button
              type="button"
              className="app-header-version-badge"
              onClick={() => setChangelogOpen(true)}
              title={`查看版本更新记录 (${APP_VERSION_LABEL})`}
              aria-label={`查看版本更新记录 ${APP_VERSION_LABEL}`}
            >
              {APP_VERSION_LABEL}
            </button>
          </div>
          <h1 className="app-header-title">{title}</h1>
        </div>
      </div>
      <Suspense fallback={<NavTabsFallback />}>
        <NavTabs />
      </Suspense>
      {children != null && children !== false ? (
        <div className="app-header-controls">
          {topicControls ? <>
          <button
            ref={controlsButton}
            type="button"
            className="topic-controls-toggle"
            aria-label={controlsExpanded ? "收起日期与时段设置" : "展开日期与时段设置"}
            aria-expanded={controlsExpanded}
            aria-controls={controlsId}
            onClick={() => setControlsExpanded((value) => !value)}
          >
            {controlsExpanded ? "收起" : "调整"}
          </button>
          <div id={controlsId} className="app-header-controls-content"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.stopPropagation();
              setControlsExpanded(false);
              controlsButton.current?.focus({ preventScroll: true });
            }}>
            {children}
          </div>
          </> : children}
        </div>
      ) : (
        <div className="app-header-controls app-header-controls-empty" aria-hidden="true" />
      )}
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </header>
  );
}
