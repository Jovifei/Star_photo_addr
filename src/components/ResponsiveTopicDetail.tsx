"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function ResponsiveTopicDetail({
  label,
  onClose,
  children,
  className = "",
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const active = document.activeElement;
    triggerRef.current = active instanceof HTMLElement ? active : null;
    const layer = layerRef.current;
    const compact = window.matchMedia("(max-width: 1199px)").matches;
    const previousOverflow = document.body.style.overflow;
    if (compact) document.body.style.overflow = "hidden";

    const focusables = () =>
      Array.from(layer?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
        .filter((element) => !element.hidden && element.offsetParent !== null);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!layer) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
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

    document.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      const close = layer?.querySelector<HTMLElement>("[data-detail-close]");
      (close ?? focusables()[0])?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const trigger = triggerRef.current;
      if (trigger && document.contains(trigger)) {
        window.requestAnimationFrame(() => trigger.focus());
      }
    };
  }, []);

  return (
    <div
      ref={layerRef}
      className={`topic-detail-layer ${className}`.trim()}
      data-testid="topic-detail-layer"
    >
      <button
        type="button"
        className="topic-detail-backdrop"
        aria-label={`关闭${label}`}
        onClick={onClose}
      />
      <div className="topic-detail-dialog-host">{children}</div>
    </div>
  );
}
