"use client";

import { Move, RotateCcw, Type } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "jovi-map-panel-layout-v2";

type PanelKey = "places" | "layers" | "darksky";

interface PanelLayout {
  x: number;
  y: number;
  scale: number;
}

type LayoutMap = Record<PanelKey, PanelLayout>;

const DEFAULT_LAYOUTS: LayoutMap = {
  places: { x: 0, y: 0, scale: 1.08 },
  layers: { x: 0, y: 0, scale: 1.08 },
  darksky: { x: 0, y: 0, scale: 1 },
};

const PANELS: Array<{
  key: PanelKey;
  label: string;
  selector: string;
  handleSelector: string;
  origin: string;
}> = [
  {
    key: "places",
    label: "观星地点",
    selector: ".observing-map-control",
    handleSelector: ".observing-map-control-title",
    origin: "top left",
  },
  {
    key: "layers",
    label: "云量与图层",
    selector: ".cloud-control",
    handleSelector: ".cloud-control-head",
    origin: "top right",
  },
  {
    key: "darksky",
    label: "暗夜图层",
    selector: ".bortle-control",
    handleSelector: ".bortle-strip",
    origin: "bottom left",
  },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function parseLayouts(raw: string | null): LayoutMap {
  if (!raw) return DEFAULT_LAYOUTS;
  try {
    const parsed = JSON.parse(raw) as Partial<LayoutMap>;
    return Object.fromEntries(
      PANELS.map(({ key }) => {
        const candidate = parsed[key];
        return [
          key,
          {
            x: Number.isFinite(candidate?.x) ? Number(candidate?.x) : 0,
            y: Number.isFinite(candidate?.y) ? Number(candidate?.y) : 0,
            scale: clamp(
              Number.isFinite(candidate?.scale)
                ? Number(candidate?.scale)
                : DEFAULT_LAYOUTS[key].scale,
              0.9,
              1.35,
            ),
          },
        ];
      }),
    ) as LayoutMap;
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

function readStoredLayouts(): LayoutMap {
  try {
    return parseLayouts(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LAYOUTS;
  }
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest(
        "button, input, select, textarea, a, summary, [role='button'], [data-no-panel-drag]",
      ),
    )
  );
}

/**
 * Progressive enhancement for the three map panels.
 *
 * This component is mounted through `next/dynamic({ ssr: false })`, so its
 * lazy state initializer may safely restore local browser preferences without
 * an extra hydration render or a synchronous setState inside an effect.
 */
export default function MapPanelManager() {
  const [selected, setSelected] = useState<PanelKey>("layers");
  const [layouts, setLayouts] = useState<LayoutMap>(readStoredLayouts);
  const layoutsRef = useRef(layouts);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
    } catch {
      // Layout persistence is optional; the current session remains usable.
    }

    for (const panelDefinition of PANELS) {
      const panel = document.querySelector<HTMLElement>(
        panelDefinition.selector,
      );
      if (!panel) continue;
      const layout = layouts[panelDefinition.key];
      panel.classList.add("map-panel-managed");
      panel.style.setProperty("--map-panel-x", `${layout.x}px`);
      panel.style.setProperty("--map-panel-y", `${layout.y}px`);
      panel.style.setProperty("--map-panel-scale", String(layout.scale));
      panel.style.transformOrigin = panelDefinition.origin;
      panel.dataset.panelKey = panelDefinition.key;
    }
  }, [layouts]);

  useEffect(() => {
    const cleanups = new Map<HTMLElement, () => void>();

    const bindPanels = () => {
      for (const panelDefinition of PANELS) {
        const panel = document.querySelector<HTMLElement>(
          panelDefinition.selector,
        );
        const handle = panel?.querySelector<HTMLElement>(
          panelDefinition.handleSelector,
        );
        if (!panel || !handle || cleanups.has(handle)) continue;

        handle.classList.add("map-panel-drag-handle");
        handle.title = `${panelDefinition.label}：拖动标题可移动面板`;

        const onPointerDown = (event: PointerEvent) => {
          if (event.button !== 0 || isInteractiveTarget(event.target)) return;
          event.preventDefault();
          event.stopPropagation();
          setSelected(panelDefinition.key);

          const starting = layoutsRef.current[panelDefinition.key];
          const startX = event.clientX;
          const startY = event.clientY;
          panel.classList.add("is-panel-dragging");
          handle.setPointerCapture?.(event.pointerId);

          const onPointerMove = (moveEvent: PointerEvent) => {
            const maxX = Math.max(80, window.innerWidth * 0.7);
            const maxY = Math.max(80, window.innerHeight * 0.65);
            setLayouts((current) => ({
              ...current,
              [panelDefinition.key]: {
                ...current[panelDefinition.key],
                x: clamp(
                  starting.x + moveEvent.clientX - startX,
                  -maxX,
                  maxX,
                ),
                y: clamp(
                  starting.y + moveEvent.clientY - startY,
                  -maxY,
                  maxY,
                ),
              },
            }));
          };

          const finish = () => {
            panel.classList.remove("is-panel-dragging");
            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", finish);
            window.removeEventListener("pointercancel", finish);
          };

          window.addEventListener("pointermove", onPointerMove);
          window.addEventListener("pointerup", finish, { once: true });
          window.addEventListener("pointercancel", finish, { once: true });
        };

        handle.addEventListener("pointerdown", onPointerDown);
        cleanups.set(handle, () => {
          handle.removeEventListener("pointerdown", onPointerDown);
          handle.classList.remove("map-panel-drag-handle");
        });
      }
    };

    const enhanceCloudChannels = () => {
      document
        .querySelectorAll<HTMLElement>(".cloud-mode-tabs button")
        .forEach((button, index) => {
          const value = Number(
            button.querySelector("b")?.textContent?.replace("%", ""),
          );
          button.classList.add("cloud-channel-bar");
          button.style.setProperty(
            "--cloud-channel-value",
            `${Number.isFinite(value) ? clamp(value, 0, 100) : 0}%`,
          );
          button.style.setProperty(
            "--cloud-channel-accent",
            ["#79cfe2", "#8ebff4", "#d4b273", "#a99bf7"][index] ??
              "#79cfe2",
          );
        });
    };

    bindPanels();
    enhanceCloudChannels();
    const observer = new MutationObserver(() => {
      bindPanels();
      enhanceCloudChannels();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observer.disconnect();
      for (const cleanup of cleanups.values()) cleanup();
    };
  }, []);

  const selectedLayout = layouts[selected];
  const selectedLabel = useMemo(
    () => PANELS.find((panel) => panel.key === selected)?.label ?? "地图面板",
    [selected],
  );

  function resetSelected() {
    setLayouts((current) => ({
      ...current,
      [selected]: DEFAULT_LAYOUTS[selected],
    }));
  }

  return (
    <section className="map-panel-manager" aria-label="地图面板显示设置">
      <div className="map-panel-manager-title">
        <Move size={14} aria-hidden="true" />
        <span>面板布局</span>
      </div>
      <select
        value={selected}
        onChange={(event) => setSelected(event.target.value as PanelKey)}
        aria-label="选择要调整的地图面板"
      >
        {PANELS.map((panel) => (
          <option key={panel.key} value={panel.key}>
            {panel.label}
          </option>
        ))}
      </select>
      <label className="map-panel-scale-control">
        <Type size={13} aria-hidden="true" />
        <span>{Math.round(selectedLayout.scale * 100)}%</span>
        <input
          type="range"
          min="0.9"
          max="1.35"
          step="0.05"
          value={selectedLayout.scale}
          onChange={(event) => {
            const scale = clamp(Number(event.target.value), 0.9, 1.35);
            setLayouts((current) => ({
              ...current,
              [selected]: { ...current[selected], scale },
            }));
          }}
          aria-label={`${selectedLabel}显示比例`}
        />
      </label>
      <button
        type="button"
        className="map-panel-reset"
        onClick={resetSelected}
        aria-label={`恢复${selectedLabel}默认位置和大小`}
        title="恢复默认位置和大小"
      >
        <RotateCcw size={14} aria-hidden="true" />
      </button>
      <small>拖动面板标题移动；调整只保存在本浏览器。</small>
    </section>
  );
}
