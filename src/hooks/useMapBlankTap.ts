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
    type Gesture = {
      pointerId: number;
      x: number;
      y: number;
      dragged: boolean;
      startedInControl: boolean;
      invalid: boolean;
      suppressClick: boolean;
    };
    let gesture: Gesture | null = null;
    const activeTouchPointers = new Set<number>();
    let invalidTouchGesture = false;
    let suppressClickUntilPointerDown = false;
    // Leaflet's internal click-disable flag does not guard this independent
    // native listener. Status controls are never blank canvas to sample.
    const blocked = (target: EventTarget | null) => target instanceof Element &&
      Boolean(target.closest(blockedSelector) || target.closest(".map-render-status"));
    const pick = (event: MouseEvent) => {
      const point = map.mouseEventToLatLng(event);
      callback.current(point.lat, point.lng);
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType === "touch") {
        if (activeTouchPointers.size === 0) {
          invalidTouchGesture = false;
          suppressClickUntilPointerDown = false;
          gesture = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            dragged: false,
            startedInControl: blocked(event.target),
            invalid: false,
            suppressClick: false,
          };
        } else if (!activeTouchPointers.has(event.pointerId)) {
          // Once a second finger joins, none of the pointers in this gesture
          // may select a location. Keep the invalid state through all ups.
          invalidTouchGesture = true;
          if (gesture) gesture.invalid = true;
          if (gesture) gesture.suppressClick = true;
        }
        activeTouchPointers.add(event.pointerId);
        return;
      }

      // A fresh mouse/pen sequence also ends suppression left by a cancelled
      // touch gesture; its own down/up/click still follows the mouse path.
      invalidTouchGesture = false;
      suppressClickUntilPointerDown = false;
      gesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        dragged: false,
        startedInControl: blocked(event.target),
        invalid: false,
        suppressClick: false,
      };
    };
    const move = (event: PointerEvent) => {
      if (!gesture || event.pointerId !== gesture.pointerId || gesture.invalid) return;
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) {
        gesture.dragged = true;
      }
    };
    const up = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !activeTouchPointers.has(event.pointerId)) return;

      activeTouchPointers.delete(event.pointerId);
      // A touch pointer-up is followed by a synthesized click when the browser
      // chooses to emit one. The touch path above owns selection for this
      // sequence, including rejected taps that began on controls or dragged.
      suppressClickUntilPointerDown = true;
      const active = gesture;
      if (
        active && event.pointerId === active.pointerId &&
        !invalidTouchGesture && !active.invalid && !active.dragged &&
        !active.startedInControl && !blocked(event.target)
      ) {
        lastTouchPick.current = { x: event.clientX, y: event.clientY, at: Date.now() };
        pick(event);
        active.suppressClick = true;
      } else if (active) {
        active.suppressClick = true;
      }

      if (activeTouchPointers.size === 0) {
        gesture = null;
        if (invalidTouchGesture) suppressClickUntilPointerDown = true;
      }
    };
    const cancel = (event: PointerEvent) => {
      const active = gesture;
      if (!active || event.pointerId !== active.pointerId) {
        if (event.pointerType === "touch" && activeTouchPointers.has(event.pointerId)) {
          activeTouchPointers.delete(event.pointerId);
          invalidTouchGesture = true;
          if (gesture) gesture.invalid = true;
          if (activeTouchPointers.size === 0) {
            gesture = null;
            suppressClickUntilPointerDown = true;
          }
        }
        return;
      }
      active.invalid = true;
      active.suppressClick = true;
      if (event.pointerType === "touch") {
        activeTouchPointers.delete(event.pointerId);
        invalidTouchGesture = true;
        if (activeTouchPointers.size === 0) {
          gesture = null;
          suppressClickUntilPointerDown = true;
        }
      }
    };
    const click = (event: MouseEvent) => {
      const active = gesture;
      if (suppressClickUntilPointerDown || invalidTouchGesture) return;
      if (active && (active.invalid || active.dragged || active.startedInControl || active.suppressClick)) return;
      if (blocked(event.target)) return;
      const lastTouch = lastTouchPick.current;
      if (lastTouch && Date.now() - lastTouch.at < 700 &&
        Math.hypot(event.clientX - lastTouch.x, event.clientY - lastTouch.y) < 8) return;
      pick(event);
    };
    container.addEventListener("pointerdown", down);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", up);
    container.addEventListener("pointercancel", cancel);
    container.addEventListener("click", click);
    return () => {
      container.removeEventListener("pointerdown", down);
      container.removeEventListener("pointermove", move);
      container.removeEventListener("pointerup", up);
      container.removeEventListener("pointercancel", cancel);
      container.removeEventListener("click", click);
    };
  }, [map, blockedSelector]);
}
