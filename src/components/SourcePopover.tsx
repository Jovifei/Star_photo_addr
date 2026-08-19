"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { VIIRS_SCIENTIFIC_BOUNDARY } from "@/data/viirsMeta";
import { hasDarkSkyLayer } from "@/lib/assets";

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

  useEffect(() => {
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
    focusable()[0]?.focus();

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
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
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
        <button className="close" type="button" onClick={onClose} aria-label="关闭">
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
          <a href="/sites" onClick={onClose}>
            推荐观星地点
          </a>
          ，在同一地图中查看光污染图层与候选点位。
        </p>
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
