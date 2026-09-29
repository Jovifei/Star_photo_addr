"use client";

import type { Map as LeafletMap } from "leaflet";
import { CloudSun, Layers3, MapPin, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { useStore } from "@/lib/store";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";
import BortleControl from "@/components/BortleControl";
import CloudControl from "@/components/CloudControl";
import MapLayerBar from "@/components/MapLayerBar";
import MapReferenceTools from "@/components/MapReferenceTools";
import ObservingMapControl from "@/components/ObservingMapControl";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";
import AdaptiveSheet from "@/components/ui/AdaptiveSheet";

/** Phones and tablets use the same map-first docked control UI. */
export const MOBILE_MAP_PANEL_QUERY =
  "(max-width: 1199px), (max-height: 520px) and (max-width: 1199px)";

const PANEL_ITEMS = [
  { id: "layers", label: "图层", title: "地图图层与视图", icon: Layers3 },
  { id: "places", label: "地点", title: "观星地点与筛选", icon: MapPin },
  { id: "cloud", label: "云量", title: "云量、模型与数据源", icon: CloudSun },
  {
    id: "recommendations",
    label: "推荐",
    title: "当前视野地点推荐",
    icon: Sparkles,
  },
] as const;

type DockPanelKey = (typeof PANEL_ITEMS)[number]["id"];
type MobilePanelKey = DockPanelKey | "summary";

function getMobilePanelSnapshot(): boolean {
  return window.matchMedia(MOBILE_MAP_PANEL_QUERY).matches;
}

function subscribeMobilePanel(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_MAP_PANEL_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function useMobilePanelViewport(): boolean {
  return useSyncExternalStore(subscribeMobilePanel, getMobilePanelSnapshot, () => false);
}

export default function ResponsiveMapControls({
  mapRef,
  ready,
  onRecommendationsChange,
  variant = "canvas",
  summaryPane = null,
}: {
  mapRef: RefObject<LeafletMap | null>;
  ready: boolean;
  onRecommendationsChange: (items: ViewportRecommendation[]) => void;
  variant?: "canvas" | "inspector" | "mobile";
  summaryPane?: ReactNode;
}) {
  const mobile = useMobilePanelViewport();
  const { setDetailOpen } = useStore();
  const [requestedPanel, setRequestedPanel] = useState<MobilePanelKey | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);
  const showMobileDock = variant === "mobile" || (variant === "canvas" && mobile);
  const activePanel = requestedPanel;

  const panelOpen = showMobileDock && activePanel !== null;

  const activeTitle = useMemo(() => {
    if (activePanel === "summary") return "今晚判断";
    return PANEL_ITEMS.find((item) => item.id === activePanel)?.title ?? "地图工具";
  }, [activePanel]);

  const closePanel = useCallback(() => {
    setRequestedPanel(null);
    setDetailOpen(false);
  }, [setDetailOpen]);

  const selectPanel = useCallback(
    (panel: MobilePanelKey) => {
      if (panel !== "summary") setDetailOpen(false);
      setRequestedPanel(panel);
    },
    [setDetailOpen],
  );
  const openPanel = useCallback(
    (panel: MobilePanelKey) => {
      if (document.activeElement instanceof HTMLElement) {
        lastTriggerRef.current = document.activeElement;
      }
      selectPanel(panel);
    },
    [selectPanel],
  );

  useEffect(() => {
    // The dynamic control shell can render one frame before matchMedia
    // settles. Do not close a just-opened drawer merely because the hook's
    // initial boolean was false while the viewport already matches mobile.
    if (!requestedPanel || mobile || getMobilePanelSnapshot()) return;
    // Deferred so the guard runs after paint instead of cascading a render.
    const frame = window.setTimeout(() => setRequestedPanel(null), 0);
    return () => window.clearTimeout(frame);
  }, [mobile, requestedPanel]);

  if (variant === "inspector") {
    return null;
  }

  if (!showMobileDock) {
    return <MapLayerBar />;
  }

  return (
    <section
      className={`mobile-map-panel-dock${activePanel ? " is-open" : ""}`}
      data-active-panel={activePanel ?? "none"}
      data-testid="mobile-map-panel-dock"
      aria-label="移动端地图工具侧边栏"
    >
      <nav className="mobile-map-panel-rail" aria-label="地图工具快捷入口">
        <button type="button" aria-label="打开地图工具" aria-expanded={panelOpen}
          aria-controls="mobile-map-panel-drawer" data-testid="mobile-map-panel-open-tools"
          onClick={() => (panelOpen ? closePanel() : openPanel("layers"))}>
          <Layers3 size={18} aria-hidden="true" /><span>图层</span>
        </button>
      </nav>

      <AdaptiveSheet
        open={panelOpen}
        title={activeTitle}
        id="mobile-map-panel-drawer"
        onClose={closePanel}
        triggerRef={lastTriggerRef}
        className="mobile-map-panel-drawer"
        backdropClassName="mobile-map-panel-backdrop"
        bodyClassName="mobile-map-panel-body"
        testId="mobile-map-panel-drawer"
        header={(
          <header className="mobile-map-panel-drawer-head">
            <div>
              <span>地图工具</span>
              <strong>{activeTitle}</strong>
            </div>
            <button type="button" onClick={closePanel} aria-label="关闭地图工具侧边栏">
              <X size={19} aria-hidden="true" />
            </button>
          </header>
        )}
        navigation={(
          <div className="mobile-map-panel-tabs" role="tablist" aria-label="地图工具分类">
            {PANEL_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activePanel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={active ? "active" : ""}
                  onClick={() => selectPanel(item.id)}
                >
                  <Icon size={15} aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      >
          {activePanel === "layers" ? (
            <div className="mobile-map-panel-pane" role="tabpanel" data-panel="layers">
              <MapLayerBar />
              <BortleControl />
              <MapReferenceTools mapRef={mapRef} />
            </div>
          ) : null}

          {activePanel === "places" ? (
            <div className="mobile-map-panel-pane" role="tabpanel" data-panel="places">
              <ObservingMapControl docked />
            </div>
          ) : null}

          {activePanel === "cloud" ? (
            <div className="mobile-map-panel-pane" role="tabpanel" data-panel="cloud">
              <CloudControl />
            </div>
          ) : null}

          {activePanel === "recommendations" ? (
            <div className="mobile-map-panel-pane" role="tabpanel" data-panel="recommendations">
              <ViewportRecommendationPanel
                mapRef={mapRef}
                ready={ready}
                onRecommendationsChange={onRecommendationsChange}
              />
            </div>
          ) : null}

          {activePanel === "summary" ? (
            <div className="mobile-map-panel-pane" role="tabpanel" data-panel="summary">
              {summaryPane}
            </div>
          ) : null}
      </AdaptiveSheet>
    </section>
  );
}
