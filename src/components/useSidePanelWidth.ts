"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";

export const SIDE_PANEL_WIDTH_KEY = "perseids-side-panel-width-v1";
export const MIN_PANEL_WIDTH = 420;
export const MAX_PANEL_WIDTH = 920;
export const DEFAULT_PANEL_WIDTH = 560;
const DRAG_RESET_GUARD_MS = 2000;

export interface SidePanelWidthControls {
  isMobile: boolean;
  width: number | null;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onResizeKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  resetWidth: () => void;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(
      "(max-width: 768px), (max-height: 520px) and (max-width: 1024px)",
    );
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

function readSavedWidth() {
  if (typeof window === "undefined") return null;
  try {
    const saved = Number(localStorage.getItem(SIDE_PANEL_WIDTH_KEY));
    if (Number.isFinite(saved) && saved >= MIN_PANEL_WIDTH) {
      return Math.min(MAX_PANEL_WIDTH, Math.round(saved));
    }
  } catch {
    // localStorage can be unavailable in private browsing.
  }
  return null;
}

function clampWidth(value: number) {
  return Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(value)));
}

function getRenderedPanelWidth(target: HTMLElement) {
  const panel = target.closest<HTMLElement>(".workspace")?.querySelector<HTMLElement>(".side-panel");
  return panel?.getBoundingClientRect().width ?? DEFAULT_PANEL_WIDTH;
}

export function useSidePanelWidth(): SidePanelWidthControls {
  const isMobile = useIsMobile();
  // Read persisted browser state after hydration. A lazy localStorage read
  // would make the server render the default width and the first client render
  // the saved width, which is another avoidable hydration mismatch.
  const [width, setWidth] = useState<number | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number; liveWidth: number } | null>(null);
  const dragMovedRef = useRef(false);
  const lastDragEndAtRef = useRef(0);

  const clearDragStyles = useCallback(() => {
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const persistWidth = useCallback((nextWidth: number) => {
    const safeWidth = clampWidth(nextWidth);
    setWidth(safeWidth);
    try {
      localStorage.setItem(SIDE_PANEL_WIDTH_KEY, String(safeWidth));
    } catch {
      // Ignore quota / private-mode failures; the current session still works.
    }
  }, []);

  const finishDrag = useCallback((event?: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    lastDragEndAtRef.current = Date.now();
    clearDragStyles();
    if (event && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    persistWidth(drag.liveWidth);
  }, [clearDragStyles, persistWidth]);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobile || event.button !== 0) return;
    event.preventDefault();
    const startWidth = width ?? getRenderedPanelWidth(event.currentTarget);
    if (Date.now() - lastDragEndAtRef.current > DRAG_RESET_GUARD_MS) {
      dragMovedRef.current = false;
    }
    dragRef.current = {
      startX: event.clientX,
      startWidth,
      liveWidth: startWidth,
    };
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, [isMobile, width]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.preventDefault();
    dragMovedRef.current = true;
    // The panel is right anchored: moving the rail left makes the panel wider.
    drag.liveWidth = clampWidth(drag.startWidth + drag.startX - event.clientX);
    setWidth(drag.liveWidth);
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(event);
  }, [finishDrag]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(event);
  }, [finishDrag]);

  const onLostPointerCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    finishDrag(event);
  }, [finishDrag]);

  const resetWidth = useCallback(() => {
    // Browser drag helpers can synthesize a double-click after pointerup.
    // A completed drag must win over that synthetic reset so the rendered
    // panel width stays in sync with the persisted value.
    if (dragMovedRef.current || Date.now() - lastDragEndAtRef.current < DRAG_RESET_GUARD_MS) {
      return;
    }
    dragRef.current = null;
    clearDragStyles();
    setWidth(null);
    try {
      localStorage.removeItem(SIDE_PANEL_WIDTH_KEY);
    } catch {
      // Ignore private-mode/localStorage failures.
    }
  }, [clearDragStyles]);

  const onResizeKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (isMobile) return;
    const current = width ?? getRenderedPanelWidth(event.currentTarget);
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      persistWidth(current + (event.key === "ArrowLeft" ? step : -step));
    } else if (event.key === "Home") {
      event.preventDefault();
      persistWidth(MIN_PANEL_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      persistWidth(MAX_PANEL_WIDTH);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      resetWidth();
    }
  }, [isMobile, persistWidth, resetWidth, width]);

  useEffect(() => () => {
    dragRef.current = null;
    clearDragStyles();
  }, [clearDragStyles]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = readSavedWidth();
      if (saved !== null) setWidth(saved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return {
    isMobile,
    width,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onLostPointerCapture,
    onResizeKeyDown,
    resetWidth,
  };
}
