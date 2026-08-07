"use client";

import { VIIRS_SCIENTIFIC_BOUNDARY } from "@/data/viirsMeta";

/** "数据依据与局限" popover describing data sources and limitations. */
export default function SourcePopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="popover-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
    >
      <div className="popover" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <h2>数据依据与局限</h2>
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
            <strong>暗夜参考</strong>：全球 2015 暗夜世界地图 + 中国 2024 VIIRS（VNP46A4）增强层，客户端像素采样得到 Bortle 等效等级。
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
          完整公式、参数与验证方法见{" "}
          <a href="/viirs#bortle" onClick={onClose}>
            /viirs#bortle
          </a>
          。
        </p>
      </div>
    </div>
  );
}
