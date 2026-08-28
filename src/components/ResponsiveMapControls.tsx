"use client";

import type { Map as LeafletMap } from "leaflet";
import { CloudSun, Layers3, MapPin, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useStore } from "@/lib/store";
import type { ViewportRecommendation } from "@/lib/viewportRecommendations";
import BortleControl from "@/components/BortleControl";
import CloudControl from "@/components/CloudControl";
import ForecastThemeSwitch from "@/components/ForecastThemeSwitch";
import MapBoundaryStatus from "@/components/MapBoundaryStatus";
import MapLayerBar from "@/components/MapLayerBar";
import MapLegend from "@/components/MapLegend";
import MapPanelManager from "@/components/MapPanelManager";
import MapViewActions from "@/components/MapViewActions";
import ObservingMapControl from "@/components/ObservingMapControl";
import ViewportRecommendationPanel from "@/components/ViewportRecommendationPanel";

/** Portrait phones and short landscape phones use the same docked control UI. */
export const MOBILE_MAP_PANEL_QUERY =
  "(max-width: 768px), (max-height: 520px) and (max-width: 1024px)";

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

type MobilePanelKey = (typeof PANEL_ITEMS)[number]["id"];

function isMobilePanelViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_MAP_PANEL_QUERY).matches
  );
}

function useMobilePanelViewport(): boolean {
  const [mobile, setMobile] = useState(isMobilePanelViewport);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_MAP_PANEL_QUERY);
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return mobile;
}

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function ResponsiveMapControls({
  mapRef,
  ready,
  onRecommendationsChange,
}: {
  mapRef: RefObject<LeafletMap | null>;
  ready: boolean;
  onRecommendationsChange: (items: ViewportRecommendation[]) => void;
}) {
  const mobile = useMobilePanelViewport();
  const { state } = useStore();
  const [activePanel, setActivePanel] = useState<MobilePanelKey | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const activeTitle = useMemo(
    () =>
      PANEL_ITEMS.find((item) => item.id === activePanel)?.title ??
      "地图工具",
    [activePanel],
  );

  const closePanel = useCallback(() => {
    setActivePanel(null);
    window.requestAnimationFrame(() => lastTriggerRef.current?.focus());
  }, []);

  const openPanel = useCallback((panel: MobilePanelKey) => {
    if (document.activeElement instanceof HTMLElement) {
      lastTriggerRef.current = document.activeElement;
    }
    setActivePanel(panel);
  }, []);

  useEffect(() => {
    const drawer = drawerRef.current;
    if (drawer) drawer.inert = activePanel === null;
    if (!activePanel) return;

    window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      // Layered-modal rule: when focus lives in a topmost dialog (e.g. the
      // source popover) the drawer must not trap Tab or close on Escape.
      if (
        !drawerRef.current ||
        !drawerRef.current.contains(document.activeElement)
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
        return;
      }
      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activePanel, closePanel]);

  useEffect(() => {
    // The dynamic control shell can render one frame before matchMedia
    // settles. Do not close a just-opened drawer merely because the hook's
    // initial boolean was false while the viewport already matches mobile.
    if (!activePanel || mobile || isMobilePanelViewport()) return;
    // Deferred so the guard runs after paint instead of cascading a render.
    const frame = window.setTimeout(() => setActivePanel(null), 0);
    return () => window.clearTimeout(frame);
  }, [activePanel, mobile]);

  if (!mobile) {
    return (
      <>
        <MapViewActions mapRef={mapRef} />
        {state.mapWorkspace !== "sites" && <ForecastThemeSwitch />}
        <MapLayerBar />
        <BortleControl />
        <CloudControl />
        <ObservingMapControl />
        <ViewportRecommendationPanel
          mapRef={mapRef}
          ready={ready}
          onRecommendationsChange={onRecommendationsChange}
        />
        <MapLegend />
        <MapPanelManager />
        <MapBoundaryStatus />
      </>
    );
  }

  return (
    <section
      className={`mobile-map-panel-dock${activePanel ? " is-open" : ""}`}
      data-active-panel={activePanel ?? "none"}
      data-testid="mobile-map-panel-dock"
      aria-label="移动端地图工具侧边栏"
    >
      <nav className="mobile-map-panel-rail" aria-label="地图工具快捷入口">
        {PANEL_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePanel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "active" : ""}
              aria-pressed={active}
              aria-expanded={active}
              aria-controls="mobile-map-panel-drawer"
              onClick={() => (active ? closePanel() : openPanel(item.id))}
              data-testid={`mobile-map-panel-open-${item.id}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="mobile-map-panel-backdrop"
        onClick={closePanel}
        aria-label="关闭地图工具侧边栏"
        hidden={!activePanel}
      />

      <aside
        id="mobile-map-panel-drawer"
        ref={drawerRef}
        className="mobile-map-panel-drawer"
        role="complementary"
        aria-hidden={!activePanel}
        aria-label={activeTitle}
        data-testid="mobile-map-panel-drawer"
      >
        <header className="mobile-map-panel-drawer-head">
          <div>
            <span>地图工具</span>
            <strong>{activeTitle}</strong>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closePanel}
            aria-label="关闭地图工具侧边栏"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

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
                onClick={() => setActivePanel(item.id)}
              >
                <Icon size={15} aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="mobile-map-panel-body">
          <div
            className="mobile-map-panel-pane"
            role="tabpanel"
            data-panel="layers"
            hidden={activePanel !== "layers"}
          >
            <MapLayerBar />
            {state.mapWorkspace !== "sites" && <ForecastThemeSwitch />}
            <MapViewActions mapRef={mapRef} />
            <BortleControl />
            <MapLegend />
            <MapBoundaryStatus />
          </div>

          <div
            className="mobile-map-panel-pane"
            role="tabpanel"
            data-panel="places"
            hidden={activePanel !== "places"}
          >
            <ObservingMapControl docked />
          </div>

          <div
            className="mobile-map-panel-pane"
            role="tabpanel"
            data-panel="cloud"
            hidden={activePanel !== "cloud"}
          >
            <CloudControl />
          </div>

          <div
            className="mobile-map-panel-pane"
            role="tabpanel"
            data-panel="recommendations"
            hidden={activePanel !== "recommendations"}
          >
            <ViewportRecommendationPanel
              mapRef={mapRef}
              ready={ready}
              onRecommendationsChange={onRecommendationsChange}
            />
          </div>
        </div>
      </aside>
    </section>
  );
}
