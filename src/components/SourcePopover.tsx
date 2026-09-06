"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { VIIRS_SCIENTIFIC_BOUNDARY } from "@/data/viirsMeta";
import { hasDarkSkyLayer } from "@/lib/assets";
import { buildProductHref } from "@/lib/productRoutes";
import { useStore } from "@/lib/store";

/**
 * "数据依据与局限" dialog describing data sources and limitations.
 *
 * It is portalled to document.body so the fixed backdrop is relative to the
 * viewport rather than the backdrop-filter containing block in the top bar.
 */
export default function SourcePopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { state } = useStore();
  const sitesHref = buildProductHref("/sites", {
    location: state.selectedLocation,
    night: state.selectedNight,
    model: state.cloudState.model,
    forecastTime: state.cloudState.activeForecastTime,
    observationTime: state.cloudState.activeObservationTime,
    overlay: state.cloudState.overlayMode,
  });

  useLayoutEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );

    // Pointer/click focus ordering differs on mobile WebKit: React may commit
    // the open dialog (and run this layout effect) before the originating click
    // finishes its default focus action, which can steal focus back to the
    // trigger. Focus immediately for normal browsers, then retry after the
    // opening event has completed. Retries are guarded so they never override
    // a user who has already moved focus inside the dialog.
    const focusInitial = () => {
      const currentDialog = dialogRef.current;
      const target = closeButtonRef.current ?? focusable()[0];
      if (!currentDialog || !target) return;
      const active = document.activeElement;
      if (active instanceof Node && currentDialog.contains(active)) return;
      target.focus({ preventScroll: true });
    };
    focusInitial();
    const frame = window.requestAnimationFrame(focusInitial);
    const timer = window.setTimeout(focusInitial, 80);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      // Handle the boundary on the dialog during capture. WebKit can update
      // document.activeElement before a document-level bubbling listener sees
      // Shift+Tab, while the event target still identifies the boundary item.
      const origin =
        event.target instanceof HTMLElement
          ? event.target
          : document.activeElement;
      if (event.shiftKey && origin === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && origin === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog?.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      dialog?.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div className="popover-backdrop" onMouseDown={onClose}>
      <div
        id="source-popover"
        ref={dialogRef}
        className="popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-popover-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          className="close"
          type="button"
          tabIndex={0}
          onClick={onClose}
          aria-label="关闭"
        >
          <X size={20} aria-hidden="true" />
        </button>
        <h2 id="source-popover-title">数据依据与局限</h2>
        <p>
          本站点用于流星雨观测规划，预测不构成现场安全判断。主要数据来源：
        </p>
        <ul>
          <li>
            <strong>天气</strong>：Open-Meteo 全球数值预报（逐小时温度、云量、降水、风、能见度），按地点当地时区呈现。
          </li>
          <li>
            <strong>天文</strong>：Astronomy Engine 计算的太阳/月亮高度、月相与银河核心高度。
          </li>
          <li>
            <strong>暗夜参考</strong>：仅在安装了来源和许可均可核验的暗夜栅格后启用。当前状态：
            {hasDarkSkyLayer() ? "已安装" : "未安装，页面不会伪造 Bortle/SQM 数值"}。
          </li>
          <li>
            <strong>地理编码</strong>：Open-Meteo Geocoding（无密钥、全球）。
          </li>
        </ul>
        <div className="note">
          <p>
            暗夜等级为 Bortle 等效映射，并非现场实测 Bortle；中国以外区域采样编码未知，标记为「不确定」。
            {VIIRS_SCIENTIFIC_BOUNDARY}
          </p>
        </div>
        <p>
          继续前往{" "}
          <Link href={sitesHref} onClick={onClose}>
            暗夜选址
          </Link>
          ，在同一地图中查看光污染图层与候选点位。
        </p>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
