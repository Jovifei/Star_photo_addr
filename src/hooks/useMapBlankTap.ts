"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

/** Leaflet click can be absent immediately after a sheet touch-drag because the
 * browser suppresses the synthesized click. Touch pointer-up is the fallback;
 * a movement threshold and synthetic-click dedupe preserve pan semantics. */
export function useMapBlankTap(
  onPick: (latitude: number, longitude: number) => void,
  blockedSelector: string,
) {
  const map = useMap();
  const callback = useRef(onPick);
  const lastTouchPick = useRef<{ x: number; y: number; at: number } | null>(null);
  useEffect(() => { callback.current = onPick; }, [onPick]);

  useEffect(() => {
    const container = map.getContainer();
    let start: { x: number; y: number } | null = null;
    let dragged = false;
    const blocked = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest(blockedSelector));
    const pick = (event: MouseEvent) => {
      const point = map.mouseEventToLatLng(event);
      callback.current(point.lat, point.lng);
      start = null;
    };
    const down = (event: PointerEvent) => { start = { x: event.clientX, y: event.clientY }; dragged = false; };
    const move = (event: PointerEvent) => {
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) dragged = true;
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || dragged || blocked(event.target)) return;
      lastTouchPick.current = { x: event.clientX, y: event.clientY, at: Date.now() };
      pick(event);
    };
    const click = (event: MouseEvent) => {
      if (dragged || blocked(event.target)) return;
      const lastTouch = lastTouchPick.current;
      if (lastTouch && Date.now() - lastTouch.at < 700 &&
        Math.hypot(event.clientX - lastTouch.x, event.clientY - lastTouch.y) < 8) return;
      pick(event);
    };
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("click", click);
    return () => {
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("click", click);
    };
  }, [map, blockedSelector]);
}
