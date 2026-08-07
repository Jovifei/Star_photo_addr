"use client";

/** Bortle explanation popover; links to the /viirs#bortle reference page. */
export default function BortleHelpPopover({
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
        <h2>波特尔暗空等级</h2>
        <p>
          暗夜图层叠加了全球 2015 暗夜世界地图与中国 2024 VIIRS（VNP46A4）增强层。点击地图任意位置，客户端读取 VIIRS
          数值瓦片像素，换算为天顶天空亮度（mag/arcsec²），再映射到 B1–B9 等效等级。
        </p>
        <p>
          B1 为极佳暗空（乡村无光害），B9 为城市中心天空。中国以外区域数值编码未知，结果标记为「不确定」。
        </p>
        <div className="note">
          <p>
            等级为 Bortle 等效映射，并非现场实测；完整公式、参数与验证方法见{" "}
            <a href="/viirs#bortle" onClick={onClose}>
              /viirs#bortle
            </a>
            。
          </p>
        </div>
      </div>
    </div>
  );
}
