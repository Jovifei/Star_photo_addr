"use client";

import { useEffect, useId, useState, type KeyboardEvent, type ReactNode } from "react";

export const INSPECTOR_TABS = [
  { id: "summary", label: "摘要" },
  { id: "places", label: "地点" },
  { id: "layers", label: "图层" },
  { id: "cloud", label: "云量" },
  { id: "recommendations", label: "推荐" },
] as const;

export type InspectorTabId = (typeof INSPECTOR_TABS)[number]["id"];

export default function ContextInspector({
  panes,
  activeTab,
  onTabChange,
}: {
  panes: Partial<Record<InspectorTabId, ReactNode>>;
  activeTab: InspectorTabId;
  onTabChange: (tab: InspectorTabId) => void;
}) {
  const baseId = useId();
  const [mounted, setMounted] = useState<Set<InspectorTabId>>(
    () => new Set<InspectorTabId>([activeTab, "recommendations"]),
  );

  useEffect(() => {
    setMounted((current) => new Set(current).add(activeTab));
  }, [activeTab]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = INSPECTOR_TABS.findIndex((tab) => tab.id === activeTab);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onTabChange(INSPECTOR_TABS[(index + 1) % INSPECTOR_TABS.length]!.id);
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onTabChange(INSPECTOR_TABS[(index - 1 + INSPECTOR_TABS.length) % INSPECTOR_TABS.length]!.id);
    }
  }

  return (
    <section className="context-inspector" data-testid="workspace-inspector">
      <div
        className="context-inspector-tabs"
        role="tablist"
        aria-label="证据页签"
        onKeyDown={onKeyDown}
      >
        {INSPECTOR_TABS.map((tab) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-${tab.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              className={selected ? "active" : ""}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {INSPECTOR_TABS.map((tab) => {
        if (!mounted.has(tab.id)) return null;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-${tab.id}`}
            hidden={tab.id !== activeTab}
            className="context-inspector-panel"
          >
            {panes[tab.id] ?? null}
          </div>
        );
      })}
    </section>
  );
}
