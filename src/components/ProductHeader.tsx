"use client";

import { Suspense, type ReactNode } from "react";
import NavTabs, { NavTabsFallback } from "@/components/NavTabs";

/**
 * The one header shared by every product workspace. Geometry lives here and
 * only here: brand block end-justified in column 1, the four product tabs
 * exactly centred in column 2, page-specific controls pinned right in
 * column 3. Pages inject their own controls through `children`; they cannot
 * drift the shared geometry anymore.
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
  return (
    <header className="app-header">
      <div className="app-header-brand">
        <span className={`app-header-mark${markClassName ? ` ${markClassName}` : ""}`} aria-hidden="true">
          {mark}
        </span>
        <div className="app-header-brand-copy">
          <p className="app-header-eyebrow">{eyebrow}</p>
          <h1 className="app-header-title">{title}</h1>
        </div>
      </div>
      <Suspense fallback={<NavTabsFallback />}>
        <NavTabs />
      </Suspense>
      {children != null && children !== false ? (
        <div className="app-header-controls">{children}</div>
      ) : (
        <div className="app-header-controls app-header-controls-empty" aria-hidden="true" />
      )}
    </header>
  );
}
