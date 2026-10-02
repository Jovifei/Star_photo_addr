"use client";

import { Suspense, useState, type ReactNode } from "react";
import NavTabs, { NavTabsFallback } from "@/components/NavTabs";
import ChangelogModal from "@/components/ChangelogModal";
import { APP_VERSION_LABEL } from "@/lib/appVersion";
import "./product-header.css";

/** Shared compact peer navigation, followed by persistent topic controls. */
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
  const topicControls = markClassName === "fireglow-mark" || markClassName === "cloudsea-mark";
  const hasControls = children != null && children !== false;

  return (
    <>
    <header className="app-header product-header" data-topic-controls={topicControls || undefined}>
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
      {hasControls && !topicControls ? (
        <div className="app-header-controls">{children}</div>
      ) : (
        <div className="app-header-controls app-header-controls-empty" aria-hidden="true" />
      )}
      <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
    </header>
    {topicControls && hasControls ? (
      <section className="product-topic-toolbar" aria-label="预报日期与时段设置">
        {children}
      </section>
    ) : null}
    </>
  );
}
