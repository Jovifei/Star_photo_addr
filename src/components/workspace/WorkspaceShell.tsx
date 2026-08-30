"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import ContextInspector, {
  type InspectorTabId,
} from "@/components/workspace/ContextInspector";
import { useMobilePanelViewport } from "@/components/ResponsiveMapControls";
import {
  INSPECTOR_WIDTH_DEFAULT,
  INSPECTOR_WIDTH_MIN,
  INSPECTOR_WIDTH_MAX,
  INSPECTOR_WIDTH_WIDE,
  useInspectorWidth,
} from "@/components/workspace/useInspectorWidth";

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
  const inspectorWidth = useInspectorWidth();

  return (
    <div className="workspace-shell app-shell" data-testid="workspace-shell">
      {header}
      <div
        className="workspace-shell-body"
        style={{
          "--workspace-inspector-width": `${inspectorWidth.width}px`,
        } as CSSProperties}
      >
        <aside className="workspace-input" data-testid="workspace-input">
          {input}
        </aside>
        <div className="workspace-canvas" data-testid="workspace-canvas">
          {canvas}
        </div>
        {!mobile ? (
          <div className="workspace-inspector-frame">
            <div
              className="workspace-inspector-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="拖动调整证据栏宽度"
              aria-valuemin={INSPECTOR_WIDTH_MIN}
              aria-valuemax={INSPECTOR_WIDTH_MAX}
              aria-valuenow={inspectorWidth.width}
              aria-valuetext={`${inspectorWidth.width}px，向左变宽，向右变窄；方向键可调整`}
              tabIndex={0}
              data-testid="workspace-inspector-resizer"
              onPointerDown={inspectorWidth.onPointerDown}
              onPointerMove={inspectorWidth.onPointerMove}
              onPointerUp={inspectorWidth.onPointerUp}
              onPointerCancel={inspectorWidth.onPointerCancel}
              onLostPointerCapture={inspectorWidth.onLostPointerCapture}
              onKeyDown={inspectorWidth.onResizeKeyDown}
              onDoubleClick={inspectorWidth.reset}
            />
            <aside className="workspace-inspector">
              <div className="workspace-inspector-width-controls" role="group" aria-label="证据栏宽度">
                <span>证据栏 {inspectorWidth.width}px</span>
                <div>
                  <button type="button" aria-label="证据栏窄宽度" onClick={() => inspectorWidth.setPreset(INSPECTOR_WIDTH_MIN)}>窄</button>
                  <button type="button" aria-label="证据栏标准宽度" onClick={() => inspectorWidth.setPreset(INSPECTOR_WIDTH_DEFAULT)}>标准</button>
                  <button type="button" aria-label="证据栏加宽" onClick={() => inspectorWidth.setPreset(INSPECTOR_WIDTH_WIDE)}>宽</button>
                </div>
              </div>
              <ContextInspector panes={inspectorPanes} activeTab={tab} onTabChange={setTab} />
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
