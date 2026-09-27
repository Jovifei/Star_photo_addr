"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMobilePanelViewport } from "@/components/ResponsiveMapControls";
import ChangelogModal from "@/components/ChangelogModal";
import { APP_VERSION_LABEL } from "@/lib/appVersion";

export type MobileSheetLevel = "peek" | "half" | "full";
const LEVELS: MobileSheetLevel[] = ["peek", "half", "full"];

/** A persistent, non-modal map companion. Only its handle owns the vertical drag. */
export default function MobileDataSheet({
  title,
  conclusion,
  bestTime,
  status,
  selectionKey,
  children,
}: {
  title: string;
  conclusion: string;
  bestTime?: string | null;
  status?: string | null;
  selectionKey?: string | null;
  children: ReactNode | ((level: MobileSheetLevel) => ReactNode);
}) {
  const mobile = useMobilePanelViewport();
  const [level, setLevel] = useState<MobileSheetLevel>("peek");
  const [changelogOpen, setChangelogOpen] = useState(false);
  const lastSelection = useRef(selectionKey);
  const dragStart = useRef<number | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectionKey && selectionKey !== lastSelection.current) setLevel("half");
    lastSelection.current = selectionKey;
  }, [selectionKey]);

  const step = (direction: -1 | 1) => {
    setLevel((current) => LEVELS[Math.max(0, Math.min(2, LEVELS.indexOf(current) + direction))]);
  };
  const stepFromButton = (direction: -1 | 1) => {
    const destination = LEVELS[Math.max(0, Math.min(2, LEVELS.indexOf(level) + direction))];
    step(direction);
    // The edge button unmounts at peek/full. Keep keyboard focus in the sheet.
    if (destination === "peek" || destination === "full") {
      const target = destination === "full" ? collapseButtonRef : expandButtonRef;
      window.requestAnimationFrame(() => (target.current ?? handleRef.current)?.focus({ preventScroll: true }));
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (start === null) return;
    const travel = event.clientY - start;
    if (Math.abs(travel) >= 36) step(travel < 0 ? 1 : -1);
  };

  if (!mobile) return null;

  return (
    <section className="mobile-data-sheet" data-level={level} data-testid="mobile-data-sheet" aria-label={`${title}数据面板`}>
      <div
        ref={handleRef}
        className="mobile-data-sheet-handle"
        role="separator"
        aria-label="拖动调整数据面板高度"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={LEVELS.indexOf(level)}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { dragStart.current = null; }}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") { event.preventDefault(); step(1); }
          if (event.key === "ArrowDown") { event.preventDefault(); step(-1); }
          if (event.key === "Escape") { event.preventDefault(); setLevel("peek"); }
        }}
      ><span /></div>
      <div className="mobile-data-sheet-summary">
        <div className="mobile-data-sheet-copy">
          <span className="mobile-data-sheet-location">{title}</span>
          <strong>{conclusion}</strong>
          <small>{level === "peek" && status ? status : bestTime || "选择地图上的地点查看条件"}</small>
        </div>
        <div className="mobile-data-sheet-actions">
          {level !== "peek" ? (
            <button ref={collapseButtonRef} type="button" aria-label="收起数据面板" onClick={() => stepFromButton(-1)}><ChevronDown size={18} aria-hidden="true" /></button>
          ) : null}
          {level !== "full" ? (
            <button ref={expandButtonRef} type="button" aria-label="展开数据面板" onClick={() => stepFromButton(1)}><ChevronUp size={18} aria-hidden="true" /></button>
          ) : null}
        </div>
      </div>
      {status && level !== "peek" ? <p className="mobile-data-sheet-status" role="status">{status}</p> : null}
      <div className="mobile-data-sheet-body" data-testid="mobile-data-sheet-body">
        {typeof children === "function" ? children(level) : children}
        <button type="button" className="mobile-sheet-version" aria-label={`查看版本更新记录 ${APP_VERSION_LABEL}`}
          onClick={() => setChangelogOpen(true)}>更新记录 · {APP_VERSION_LABEL}</button>
        <ChangelogModal open={changelogOpen} onClose={() => setChangelogOpen(false)} />
      </div>
    </section>
  );
}
