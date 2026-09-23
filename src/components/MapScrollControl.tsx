"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { Control, DomEvent, DomUtil } from "leaflet";
import { bindMapBrowserInteraction } from "@/lib/mapBrowserInteraction";

/** Native page scroll first; map panning is an explicit, reversible mode. */
export default function MapScrollControl() {
  const map = useMap();
  useEffect(() => {
    const control = new Control({ position: "topleft" });
    const button = DomUtil.create("button", "map-scroll-control");
    button.type = "button";
    control.onAdd = () => {
      DomEvent.disableClickPropagation(button);
      DomEvent.disableScrollPropagation(button);
      return button;
    };
    const release = bindMapBrowserInteraction(map, button, (visible) => {
      if (visible) control.addTo(map);
      else control.remove();
    });
    return () => { release(); control.remove(); };
  }, [map]);
  return null;
}
