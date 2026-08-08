"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BORTLE_CLASSES,
  BORTLE_LOWER_BOUNDS_MPSAS,
  VIIRS_DISPLAY_CALIBRATION,
  VIIRS_MODEL,
  VIIRS_SCIENTIFIC_BOUNDARY,
  VIIRS_VALIDATION,
  VIIRS_WEB_LAYER,
} from "@/data/viirsMeta";

function CoefficientTable({ coefficients }: { coefficients: number[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>系数</th>
          <th>值</th>
        </tr>
      </thead>
      <tbody>
        {coefficients.map((value, index) => (
          <tr key={index}>
            <td>a{index}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Collapsible section preserving the original VIIRS dark-sky documentation.
 *
 * This component is rendered at the bottom of the recommendation page so the
 * scientific content (Bortle classification, PSF model, calibration) remains
 * accessible without cluttering the main recommendation UI.
 */
export default function ViirsDocCollapse() {
  const [open, setOpen] = useState(false);

  return (
    <div className="viirs-doc-collapse">
      <button
        type="button"
        className="viirs-doc-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "▼" : "▶"} 暗夜等级公式与验证方法
      </button>

      {open && (
        <div className="viirs-doc-content viirs-page">
          <h2 id="bortle">Bortle 等效分类</h2>
          <p>
            分类为「Bortle 等效映射」，并非现场实测 Bortle。每一级由天顶天空亮度
            （mag/arcsec²，mpsas）的下限界定；mpsas 高于该级下限即归入该级，全部不满足归入
            B9（城市中心天空）。
          </p>
          <table>
            <thead>
              <tr>
                <th>等级</th>
                <th>名称</th>
                <th>色带</th>
                <th>下限 mpsas</th>
              </tr>
            </thead>
            <tbody>
              {BORTLE_CLASSES.map((klass) => (
                <tr key={klass.level}>
                  <td>B{klass.level}</td>
                  <td>{klass.name}</td>
                  <td>
                    <span
                      className="swatch"
                      style={{
                        background: klass.color,
                        border: "1px solid var(--line)",
                      }}
                    />
                    {klass.color}
                  </td>
                  <td>
                    {klass.level <= 8
                      ? BORTLE_LOWER_BOUNDS_MPSAS[klass.level - 1].toFixed(2)
                      : "—（无下限）"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h2>数值编码（像素 → 天顶亮度）</h2>
          <p>中国 z=8 数值瓦片每个像素的灰度值编码如下：</p>
          <code className="formula">{VIIRS_WEB_LAYER.valueEncoding}</code>
          <p>即：</p>
          <code className="formula">
            mpsas = value === 0 ? null : 14 + (value - 1) / 254 * 8
          </code>
          <p>
            其中 0 表示 nodata（无数据），有效值 1–255 线性映射到 14–22
            mag/arcsec²。编码语义：{VIIRS_WEB_LAYER.valueSemantics}。
          </p>

          <h2>物理 PSF 模型</h2>
          <p>
            模型版本 <code>{VIIRS_MODEL.version}</code>（物理模型{" "}
            <code>{VIIRS_MODEL.physicalModelVersion}</code>）。天顶人造辐射亮度由
            以下解析模型给出：
          </p>
          <code className="formula">{VIIRS_MODEL.formula}</code>
          <CoefficientTable coefficients={VIIRS_MODEL.coefficients} />
          <p>
            拟合优度 R² = {VIIRS_MODEL.fitR2}，log10 RMSE ={" "}
            {VIIRS_MODEL.fitRmseLog10}。自然天空亮度基准{" "}
            {VIIRS_MODEL.naturalSkyMpsas} mpsas，V 波段零点{" "}
            {VIIRS_MODEL.vBandZeroPointWm2Sr} W·m⁻²·sr⁻¹。
          </p>

          <h2>显示校准（零锚定外部显示对齐）</h2>
          <p>版本 {VIIRS_DISPLAY_CALIBRATION.version}：</p>
          <code className="formula">{VIIRS_DISPLAY_CALIBRATION.formula}</code>
          <p>
            无量纲尺度 S = {VIIRS_DISPLAY_CALIBRATION.dimensionlessScale}，指数 γ ={" "}
            {VIIRS_DISPLAY_CALIBRATION.exponentGamma}；零人造辐射亮度锚定到{" "}
            {VIIRS_DISPLAY_CALIBRATION.zeroArtificialRadianceMpsas} mpsas。
          </p>

          <div className="note">
            <p>
              <strong>科学边界：</strong>
              {VIIRS_SCIENTIFIC_BOUNDARY}
            </p>
          </div>

          <h2>验证方法与报告指标</h2>
          <p>
            建议的独立验证协议：月亮低于地平、太阳低于 −18°、晴空、排除局地直接灯光，
            记录 AOD550 并取重复中位数。报告指标包括：
          </p>
          <ul>
            {VIIRS_VALIDATION.metrics.map((metric) => (
              <li key={metric}>
                <code>{metric}</code>
              </li>
            ))}
          </ul>
          <p>
            筛选不确定性：{VIIRS_VALIDATION.screeningUncertainty}。注：外部显示基准并非
            SQM 真值。
          </p>

          <h2>使用说明</h2>
          <p>
            客户端在点击地图时读取对应数值瓦片像素，按上述编码换算 mpsas 并分类。中国以外区域（全球
            2015 暗夜世界地图）数值编码未知，结果标记为「不确定」。瓦片类型：
            <code>{VIIRS_WEB_LAYER.type}</code>，opacity {VIIRS_WEB_LAYER.opacity}。
          </p>

          <Link className="viirs-back" href="/">
            ← 返回逐星地图
          </Link>
        </div>
      )}
    </div>
  );
}
