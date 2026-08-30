"use client";

import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";

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
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = INSPECTOR_TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nextIndex = (index + 1) % INSPECTOR_TABS.length;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nextIndex = (index - 1 + INSPECTOR_TABS.length) % INSPECTOR_TABS.length;
    }
    if (nextIndex === null) return;
    onTabChange(INSPECTOR_TABS[nextIndex]!.id);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section className="context-inspector" data-testid="workspace-inspector">
      <div
        className="context-inspector-tabs"
        role="tablist"
        aria-label="证据页签"
        onKeyDown={onKeyDown}
      >
        {INSPECTOR_TABS.map((tab, index) => {
          const selected = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              ref={(node) => {
                tabRefs.current[index] = node;
              }}
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
        if (tab.id !== activeTab) return null;
        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={`${baseId}-panel-${tab.id}`}
            aria-labelledby={`${baseId}-${tab.id}`}
            className="context-inspector-panel"
          >
            {panes[tab.id] ?? null}
          </div>
        );
      })}
    </section>
  );
}
