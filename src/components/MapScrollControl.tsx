"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { Control, DomEvent, DomUtil } from "leaflet";

/** A one-finger swipe scrolls the page until the user explicitly moves the map. */
export default function MapScrollControl() {
  const map = useMap();
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1199px)");
    const container = map.getContainer();
    const wasDragging = map.dragging.enabled();
    const wasWheel = map.scrollWheelZoom.enabled();
    const wasTouchZoom = map.touchZoom.enabled();
    const control = new Control({ position: "topleft" });
    const button = DomUtil.create("button", "map-scroll-control");
    button.type = "button";
    let interactive = false;
    const sync = () => {
      const scrollPage = query.matches && !interactive;
      container.classList.toggle("map-page-scroll", scrollPage);
      if (scrollPage) {
        map.dragging.disable();
        map.scrollWheelZoom.disable();
        map.touchZoom.disable();
      } else {
        if (wasDragging) map.dragging.enable();
        if (wasWheel) map.scrollWheelZoom.enable();
        if (wasTouchZoom) map.touchZoom.enable();
      }
      button.textContent = interactive ? "完成 · 恢复页面滑动" : "移动地图";
      button.setAttribute("aria-pressed", String(interactive));
    };
    control.onAdd = () => {
      DomEvent.disableClickPropagation(button);
      DomEvent.disableScrollPropagation(button);
      return button;
    };
    const toggle = () => { interactive = !interactive; sync(); };
    const resize = () => {
      interactive = false;
      if (query.matches) control.addTo(map); else control.remove();
      sync();
    };
    button.addEventListener("click", toggle);
    query.addEventListener("change", resize);
    resize();
    return () => {
      control.remove();
      button.removeEventListener("click", toggle);
      query.removeEventListener("change", resize);
      container.classList.remove("map-page-scroll");
      if (wasDragging) map.dragging.enable();
      if (wasWheel) map.scrollWheelZoom.enable();
      if (wasTouchZoom) map.touchZoom.enable();
    };
  }, [map]);
  return null;
}
