"use client";

import { useState, type ReactNode } from "react";
import ContextInspector, {
  type InspectorTabId,
} from "@/components/workspace/ContextInspector";
import { useMobilePanelViewport } from "@/components/ResponsiveMapControls";

export default function WorkspaceShell({
  header,
  input,
  canvas,
  inspectorPanes,
  initialTab = "summary",
  activeTab,
  onTabChange,
}: {
  header: ReactNode;
  input: ReactNode;
  canvas: ReactNode;
  inspectorPanes: Parameters<typeof ContextInspector>[0]["panes"];
  initialTab?: InspectorTabId;
  activeTab?: InspectorTabId;
  onTabChange?: (tab: InspectorTabId) => void;
}) {
  const mobile = useMobilePanelViewport();
  const [internalTab, setInternalTab] = useState<InspectorTabId>(initialTab);
  const tab = activeTab ?? internalTab;
  const setTab = onTabChange ?? setInternalTab;

  return (
    <div className="workspace-shell app-shell" data-testid="workspace-shell">
      {header}
      <div className="workspace-shell-body">
        <aside className="workspace-input" data-testid="workspace-input">
          {input}
        </aside>
        <div className="workspace-canvas" data-testid="workspace-canvas">
          {canvas}
        </div>
        {!mobile ? (
          <aside className="workspace-inspector">
            <ContextInspector panes={inspectorPanes} activeTab={tab} onTabChange={setTab} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
