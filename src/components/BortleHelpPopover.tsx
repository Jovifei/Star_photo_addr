"use client";

import { hasDarkSkyLayer } from "@/lib/assets";

/** Accurate explanation of visual VIIRS versus optional local numeric rasters. */
export default function BortleHelpPopover({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  const installed = hasDarkSkyLayer();
  return (
    <div
      className="popover-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bortle-help-title"
      onMouseDown={onClose}
    >
      <div className="popover" onMouseDown={(event) => event.stopPropagation()}>
        <button className="close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
        <h2 id="bortle-help-title">Bortle、SQM 与夜光参考</h2>
        {installed ? (
          <>
            <p>
              当前构建已启用本地授权暗夜栅格。地图点击后可读取栅格值，并按项目记录的映射规则展示天顶亮度或 Bortle 等效等级。
            </p>
            <p>
              这些值仍是栅格估计，不是现场 SQM 仪器实测；出发前应结合月光、云、湿度和现场光源复核。
            </p>
          </>
        ) : (
          <>
            <p>
              当前仓库没有随代码分发 Bortle / SQM 数值栅格，因为原始资产的再分发许可尚未确认。因此“天顶亮度”和“波特尔”显示无数据，是有意的安全降级，不是天气接口故障。
            </p>
            <p>
              现在仍可使用 VIIRS 2023 视觉夜光图层进行空间参考，但不能把图片颜色当作现场 Bortle 或 SQM 数值。
            </p>
            <div className="note">
              <p>
                部署者需要取得有许可的数据文件，放入约定的 public 目录，设置对应 `NEXT_PUBLIC_ASSET_*` 构建变量，并重新构建镜像。完整步骤见仓库文档 `docs/DARK_SKY_DATA_SETUP.md`。
              </p>
            </div>
          </>
        )}
        <p>
          数据状态也可在右上“数据源状态”中查看；未安装、未配置、上游降级和正常可用使用不同状态，不会互相冒充。
        </p>
      </div>
    </div>
  );
}
