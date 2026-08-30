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

export const INPUT_WIDTH_KEY = "perseids-workspace-input-width-v1";
export const INPUT_WIDTH_MIN = 260;
export const INPUT_WIDTH_MAX = 420;
export const INPUT_WIDTH_DEFAULT = 300;
export const INPUT_WIDTH_WIDE = 420;

const subscribers = new Set<() => void>();

function subscribe(listener: () => void) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

function publish() {
  subscribers.forEach((listener) => listener());
}

export interface ColumnWidthConfig {
  storageKey: string;
  min: number;
  max: number;
  fallback: number;
  wide: number;
  /** Which edge the column grows from: "right" widens leftward, "left" widens rightward. */
  anchor: "left" | "right";
}

export interface ColumnWidthControls {
  width: number;
  min: number;
  max: number;
  wide: number;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  setPreset: (width: number) => void;
  reset: () => void;
}

export function useColumnWidth(config: ColumnWidthConfig): ColumnWidthControls {
  const { storageKey, min, max, fallback, wide, anchor } = config;
  const clamp = useCallback(
    (value: number) => Math.min(max, Math.max(min, Math.round(value))),
    [min, max],
  );
  const getStoredWidth = useCallback(() => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return fallback;
      const stored = Number(raw);
      return Number.isFinite(stored) ? clamp(stored) : fallback;
    } catch {
      return fallback;
    }
  }, [clamp, fallback, storageKey]);
  const persistedWidth = useSyncExternalStore(
    subscribe,
    getStoredWidth,
    () => fallback,
  );
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const width = dragWidth ?? persistedWidth;
  const dragRef = useRef<{ startX: number; startWidth: number; liveWidth: number } | null>(null);

  const persist = useCallback(
    (nextWidth: number) => {
      const safeWidth = clamp(nextWidth);
      try {
        localStorage.setItem(storageKey, String(safeWidth));
      } catch {
        // The in-session drag result remains usable if browser storage is unavailable.
      }
      publish();
    },
    [clamp, storageKey],
  );

  const clearPointerState = useCallback(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const finishDrag = useCallback(
    (event?: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      clearPointerState();
      if (event?.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragWidth(null);
      persist(drag.liveWidth);
    },
    [clearPointerState, persist],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      dragRef.current = { startX: event.clientX, startWidth: width, liveWidth: width };
      event.currentTarget.focus({ preventScroll: true });
      event.currentTarget.setPointerCapture?.(event.pointerId);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    },
    [width],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      const delta = anchor === "right" ? drag.startX - event.clientX : event.clientX - drag.startX;
      drag.liveWidth = clamp(drag.startWidth + delta);
      setDragWidth(drag.liveWidth);
    },
    [anchor, clamp],
  );

  const setPreset = useCallback(
    (nextWidth: number) => {
      setDragWidth(null);
      persist(nextWidth);
    },
    [persist],
  );

  const reset = useCallback(() => {
    dragRef.current = null;
    clearPointerState();
    setDragWidth(null);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // The default width still applies for this session.
    }
    publish();
  }, [clearPointerState, storageKey]);

  const onResizeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 48 : 16;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const grows = anchor === "right" ? event.key === "ArrowLeft" : event.key === "ArrowRight";
        setPreset(width + (grows ? step : -step));
      } else if (event.key === "Home") {
        event.preventDefault();
        setPreset(min);
      } else if (event.key === "End") {
        event.preventDefault();
        setPreset(max);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reset();
      }
    },
    [anchor, max, min, reset, setPreset, width],
  );

  return {
    width,
    min,
    max,
    wide,
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

export function useInspectorWidth(): ColumnWidthControls {
  return useColumnWidth({
    storageKey: INSPECTOR_WIDTH_KEY,
    min: INSPECTOR_WIDTH_MIN,
    max: INSPECTOR_WIDTH_MAX,
    fallback: INSPECTOR_WIDTH_DEFAULT,
    wide: INSPECTOR_WIDTH_WIDE,
    anchor: "right",
  });
}

export function useInputWidth(): ColumnWidthControls {
  return useColumnWidth({
    storageKey: INPUT_WIDTH_KEY,
    min: INPUT_WIDTH_MIN,
    max: INPUT_WIDTH_MAX,
    fallback: INPUT_WIDTH_DEFAULT,
    wide: INPUT_WIDTH_WIDE,
    anchor: "left",
  });
}
