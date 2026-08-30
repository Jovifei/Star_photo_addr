"use client";

import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export const INSPECTOR_WIDTH_KEY = "perseids-workspace-inspector-width-v1";
export const INSPECTOR_WIDTH_MIN = 320;
export const INSPECTOR_WIDTH_MAX = 620;
export const INSPECTOR_WIDTH_DEFAULT = 360;
export const INSPECTOR_WIDTH_WIDE = 480;

const subscribers = new Set<() => void>();

function clampWidth(value: number) {
  return Math.min(INSPECTOR_WIDTH_MAX, Math.max(INSPECTOR_WIDTH_MIN, Math.round(value)));
}

function getStoredWidth() {
  if (typeof window === "undefined") return INSPECTOR_WIDTH_DEFAULT;
  try {
    const raw = localStorage.getItem(INSPECTOR_WIDTH_KEY);
    if (raw === null) return INSPECTOR_WIDTH_DEFAULT;
    const stored = Number(raw);
    return Number.isFinite(stored) ? clampWidth(stored) : INSPECTOR_WIDTH_DEFAULT;
  } catch {
    return INSPECTOR_WIDTH_DEFAULT;
  }
}

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function publish() {
  subscribers.forEach((listener) => listener());
}

export interface InspectorWidthControls {
  width: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  setPreset: (width: number) => void;
  reset: () => void;
}

export function useInspectorWidth(): InspectorWidthControls {
  const persistedWidth = useSyncExternalStore(
    subscribe,
    getStoredWidth,
    () => INSPECTOR_WIDTH_DEFAULT,
  );
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? persistedWidth;
  const dragRef = useRef<{ startX: number; startWidth: number; liveWidth: number } | null>(null);

  const persist = useCallback((nextWidth: number) => {
    const safeWidth = clampWidth(nextWidth);
    try {
      localStorage.setItem(INSPECTOR_WIDTH_KEY, String(safeWidth));
    } catch {
      // The in-session drag result remains usable if browser storage is unavailable.
    }
    publish();
  }, []);

  const clearPointerState = useCallback(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const finishDrag = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    clearPointerState();
    if (event?.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragWidth(null);
    persist(drag.liveWidth);
  }, [clearPointerState, persist]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: width, liveWidth: width };
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, [width]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    // The inspector stays right anchored: moving left makes it wider.
    drag.liveWidth = clampWidth(drag.startWidth + drag.startX - event.clientX);
    setDragWidth(drag.liveWidth);
  }, []);

  const setPreset = useCallback((nextWidth: number) => {
    setDragWidth(null);
    persist(nextWidth);
  }, [persist]);

  const reset = useCallback(() => {
    dragRef.current = null;
    clearPointerState();
    setDragWidth(null);
    try {
      localStorage.removeItem(INSPECTOR_WIDTH_KEY);
    } catch {
      // The default width still applies for this session.
    }
    publish();
  }, [clearPointerState]);

  const onResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      setPreset(width + (event.key === "ArrowLeft" ? step : -step));
    } else if (event.key === "Home") {
      event.preventDefault();
      setPreset(INSPECTOR_WIDTH_MIN);
    } else if (event.key === "End") {
      event.preventDefault();
      setPreset(INSPECTOR_WIDTH_MAX);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      reset();
    }
  }, [reset, setPreset, width]);

  return {
    width,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
    onResizeKeyDown,
    setPreset,
    reset,
  };
}
