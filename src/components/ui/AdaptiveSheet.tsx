"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { lockCompactPageScroll } from "@/lib/pageScrollLock";

const subscribeToMount = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function AdaptiveSheet({
  open,
  title,
  id,
  onClose,
  triggerRef,
  header,
  navigation,
  children,
  className,
  backdropClassName,
  bodyClassName,
  testId,
}: {
  open: boolean;
  title: string;
  id: string;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  header: ReactNode;
  navigation?: ReactNode;
  children: ReactNode;
  className: string;
  backdropClassName: string;
  bodyClassName: string;
  testId?: string;
}) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const mounted = useSyncExternalStore(subscribeToMount, clientSnapshot, serverSnapshot);

  useEffect(() => {
    if (!mounted || !open) return;
    return lockCompactPageScroll();
  }, [mounted, open]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (sheet) sheet.inert = !open;
    if (!mounted || !open) return;

    const focusables = () =>
      Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
        .filter((element) => !element.hidden && element.offsetParent !== null);
    const frame = window.requestAnimationFrame(() => focusables()[0]?.focus({ preventScroll: true }));
    const onKeyDown = (event: KeyboardEvent) => {
      const current = sheetRef.current;
      if (!current) return;
      if (event.key === "Escape") {
        const target = event.target instanceof Element ? event.target : null;
        const nestedDialog = target?.closest(`[role="dialog"]:not(#${id})`);
        if (nestedDialog) return;
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !current.contains(document.activeElement)) return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [id, mounted, onClose, open]);

  useEffect(() => {
    if (!mounted || open) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const frame = window.requestAnimationFrame(() => trigger.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [mounted, open, triggerRef]);

  const content = (
    <>
      <button
        type="button"
        className={backdropClassName}
        onClick={onClose}
        aria-label={`关闭${title}`}
        hidden={!open}
      />
      <aside
        id={id}
        ref={sheetRef}
        className={className}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-hidden={!open}
        aria-label={title}
        data-testid={testId}
        data-adaptive-sheet="true"
      >
        {header}
        {navigation}
        <div className={bodyClassName}>{children}</div>
      </aside>
    </>
  );

  if (!mounted) return null;
  // The map tool presentation uses these ancestors for its dock geometry and
  // scoped control styles. Move that presentation intact outside map stacking
  // contexts, while the filter presentation already owns fixed positioning.
  const presentation = className.split(" ").includes("mobile-map-panel-drawer") ? (
    <div className="map-stage" data-adaptive-sheet-portal="true" hidden={!open} style={{ display: open ? "contents" : "none" }}>
      <div className={`mobile-map-panel-dock${open ? " is-open" : ""}`}>
        {content}
      </div>
    </div>
  ) : content;
  return createPortal(presentation, document.body);
}

