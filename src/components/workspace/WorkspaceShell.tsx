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
  INPUT_WIDTH_DEFAULT,
  INPUT_WIDTH_MIN,
  INPUT_WIDTH_MAX,
  useInspectorWidth,
  useInputWidth,
  type ColumnWidthControls,
} from "@/components/workspace/useInspectorWidth";

function WidthControls({
  label,
  unit,
  controls,
  presets,
}: {
  label: string;
  unit: string;
  controls: ColumnWidthControls;
  presets: { standard: number; labelNarrow: string; labelStandard: string; labelWide: string };
}) {
  return (
    <div className="workspace-width-controls" role="group" aria-label={label}>
      <span>{unit} {controls.width}px</span>
      <div>
        <button type="button" aria-label={presets.labelNarrow} onClick={() => controls.setPreset(controls.min)}>窄</button>
        <button type="button" aria-label={presets.labelStandard} onClick={() => controls.setPreset(presets.standard)}>标准</button>
        <button type="button" aria-label={presets.labelWide} onClick={() => controls.setPreset(controls.wide)}>宽</button>
      </div>
    </div>
  );
}

export default function WorkspaceShell({
  header,
  commandBar,
  input,
  canvas,
  inspectorPanes,
  initialTab = "summary",
  activeTab,
  onTabChange,
}: {
  header: ReactNode;
  commandBar?: ReactNode;
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
  const inputWidth = useInputWidth();

  return (
    <div className="workspace-shell app-shell" data-testid="workspace-shell">
      {header}
      {commandBar != null && commandBar !== false ? (
        <div className="workspace-commandbar" data-testid="workspace-commandbar">
          {commandBar}
        </div>
      ) : null}
      <div
        className="workspace-shell-body"
        style={{
          "--workspace-inspector-width": `${inspectorWidth.width}px`,
          "--workspace-input-width": `${inputWidth.width}px`,
        } as CSSProperties}
      >
        <aside className="workspace-input" data-testid="workspace-input">
          {!mobile ? (
            <WidthControls
              label="输入栏宽度"
              unit="输入栏"
              controls={inputWidth}
              presets={{
                standard: INPUT_WIDTH_DEFAULT,
                labelNarrow: "输入栏窄宽度",
                labelStandard: "输入栏标准宽度",
                labelWide: "输入栏加宽",
              }}
            />
          ) : null}
          {input}
          {!mobile ? (
            <div
              className="workspace-input-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="拖动调整输入栏宽度"
              aria-valuemin={INPUT_WIDTH_MIN}
              aria-valuemax={INPUT_WIDTH_MAX}
              aria-valuenow={inputWidth.width}
              aria-valuetext={`${inputWidth.width}px，向右变宽，向左变窄；方向键可调整`}
              tabIndex={0}
              data-testid="workspace-input-resizer"
              onPointerDown={inputWidth.onPointerDown}
              onPointerMove={inputWidth.onPointerMove}
              onPointerUp={inputWidth.onPointerUp}
              onPointerCancel={inputWidth.onPointerCancel}
              onLostPointerCapture={inputWidth.onLostPointerCapture}
              onKeyDown={inputWidth.onResizeKeyDown}
              onDoubleClick={inputWidth.reset}
            />
          ) : null}
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
              <WidthControls
                label="证据栏宽度"
                unit="证据栏"
                controls={inspectorWidth}
                presets={{
                  standard: INSPECTOR_WIDTH_DEFAULT,
                  labelNarrow: "证据栏窄宽度",
                  labelStandard: "证据栏标准宽度",
                  labelWide: "证据栏加宽",
                }}
              />
              <ContextInspector panes={inspectorPanes} activeTab={tab} onTabChange={setTab} />
            </aside>
          </div>
        ) : null}
      </div>
    </div>
  );
}
