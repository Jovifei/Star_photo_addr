"use client";

import { useMemo } from "react";
import {
  X,
  Mountain,
  Waves,
  Wind,
  Droplets,
  Sun,
  Camera,
  Layers,
  Aperture,
  CheckCircle2,
  AlertTriangle,
  CloudFog,
  Sparkles,
} from "lucide-react";
import type { CloudSeaSite } from "@/lib/cloudseaSites";
import type { CloudSeaWindowScore } from "@/lib/cloudsea";
import { positionBadgeTone } from "@/lib/cloudsea";
import { calculateSiteSunEvents } from "@/lib/astroSunUtils";

interface CloudSeaSiteDetailProps {
  site: CloudSeaSite;
  window: CloudSeaWindowScore;
  phase: "morning" | "evening";
  dateKey: string;
  onClose: () => void;
}

/** 迷你罗盘罗经微组件：绘制 360° 罗盘盘面及指针 */
function CompassDial({ degree = 0, label = "" }: { degree: number; label: string }) {
  // 指针旋转角度
  const rotation = degree % 360;
  return (
    <div className="cs-compass-widget" title={`日出方位: ${degree}° (${label})`}>
      <svg viewBox="0 0 48 48" className="cs-compass-svg" aria-hidden="true">
        {/* 外刻度圈 */}
        <circle cx="24" cy="24" r="21" className="cs-compass-outer-ring" />
        <circle cx="24" cy="24" r="17" className="cs-compass-inner-ring" />
        {/* 方位主标点 */}
        <text x="24" y="9" className="cs-compass-cardinal cs-north">N</text>
        <text x="39" y="27" className="cs-compass-cardinal">E</text>
        <text x="24" y="43" className="cs-compass-cardinal">S</text>
        <text x="9" y="27" className="cs-compass-cardinal">W</text>
        {/* 旋转指针 */}
        <g transform={`rotate(${rotation} 24 24)`}>
          <polygon points="24,10 21,24 27,24" className="cs-compass-arrow-north" />
          <polygon points="24,38 21,24 27,24" className="cs-compass-arrow-south" />
          <circle cx="24" cy="24" r="2.5" className="cs-compass-pivot" />
        </g>
      </svg>
      <div className="cs-compass-readout">
        <span className="cs-compass-deg">{degree}°</span>
        <span className="cs-compass-dir">{label}</span>
      </div>
    </div>
  );
}

export default function CloudSeaSiteDetail({
  site,
  window: win,
  phase,
  dateKey,
  onClose,
}: CloudSeaSiteDetailProps) {
  const pLevel = win.probabilityLevel ?? "p20";
  const badgeTone = positionBadgeTone(win.cloudPosition);

  // Solar events and sunrise azimuth
  const sunEvents = useMemo(() => {
    return calculateSiteSunEvents(
      dateKey,
      site.latitude,
      site.longitude,
      site.altitude,
    );
  }, [dateKey, site.latitude, site.longitude, site.altitude]);

  const targetSun = phase === "morning" ? sunEvents.sunrise : sunEvents.sunset;

  // Relative altitude diff
  const diff = win.altitudeDiffM;
  const isAbove = win.cloudPosition === "above";
  const isIn = win.cloudPosition === "in";
  const isBelow = win.cloudPosition === "below";

  // 云层厚度计算
  const cloudThickness = useMemo(() => {
    if (win.cloudTopM != null && win.cloudBaseM != null && win.cloudTopM >= win.cloudBaseM) {
      return win.cloudTopM - win.cloudBaseM;
    }
    return null;
  }, [win.cloudTopM, win.cloudBaseM]);

  // 三维气象因子进度评分（0 - 100）
  const moistureScore = Math.min(100, Math.max(10, Math.round(((win.humidity ?? 60) / 95) * 100)));
  const windScore = Math.max(10, Math.min(100, Math.round((1 - Math.min(win.windSpeed ?? 5, 12) / 14) * 100)));
  const positionScore = isAbove ? 95 : isIn ? 35 : 20;

  return (
    <aside className="cloudsea-site-detail" aria-label={`${site.name}云海摄影详情`}>
      {/* 1. 顶部 Header */}
      <div className="cs-detail-header">
        <div className="cs-detail-title-group">
          <div className="cs-detail-kicker-row">
            <span className="cs-location-chip">{site.province}</span>
            <span className="cs-area-chip">{site.area}</span>
          </div>
          <h2 className="cs-detail-name">{site.name}</h2>
          <div className="cs-detail-coords">
            <span>海拔 {site.altitude}m</span>
            <span className="cs-coord-sep">·</span>
            <span>{site.latitude.toFixed(2)}°N, {site.longitude.toFixed(2)}°E</span>
          </div>
        </div>
        <button
          type="button"
          className="cs-detail-close-btn"
          onClick={onClose}
          aria-label="关闭云海详情舱"
          title="关闭云海详情舱"
        >
          <X size={18} />
        </button>
      </div>

      <div className="cs-detail-scroll-content">
        <p className="cs-beta-note">Beta · 湿度来自 Open-Meteo；云底/云顶和条件指数为启发式估算，尚未完成现场云底仪或长期实拍概率校准。</p>
        {/* 2. 云海条件指数与条件指数 Bento 磁贴 */}
        <section className="cs-detail-card cs-hero-card">
          <div className="cs-hero-top">
            <div className="cs-hero-score-block">
              <span className="cs-hero-kicker">
                <Waves size={13} className="cs-wave-icon" /> 云海条件指数
              </span>
              <div className="cs-hero-score-number" data-level={pLevel}>
                {win.probabilityLabel ?? "—"}
              </div>
            </div>
            <div className="cs-hero-badge-block">
              <span className={`cs-pos-pill ${badgeTone}`}>
                {isAbove && <CheckCircle2 size={13} />}
                {isIn && <CloudFog size={13} />}
                {isBelow && <AlertTriangle size={13} />}
                <span>{win.positionLabel}</span>
              </span>
              <span className="cs-summary-hint">
                {isAbove ? "峰顶刺破云海 · 适宜俯瞰" : isIn ? "处于大雾中 · 视线受阻" : "处于云层下 · 阴天无海"}
              </span>
            </div>
          </div>

          {/* 三维气象指标微指示条 */}
          <div className="cs-hero-metrics-strip">
            <div className="cs-mini-metric">
              <div className="cs-mini-metric-head">
                <span className="cs-mini-label"><Droplets size={11} /> 水汽充沛度</span>
                <span className="cs-mini-val">{win.humidity != null ? `${win.humidity}%` : "—"}</span>
              </div>
              <div className="cs-mini-progress">
                <div
                  className="cs-mini-bar cs-bar-moisture"
                  style={{ width: `${moistureScore}%` }}
                />
              </div>
            </div>

            <div className="cs-mini-metric">
              <div className="cs-mini-metric-head">
                <span className="cs-mini-label"><Mountain size={11} /> 层位落差度</span>
                <span className="cs-mini-val">{diff != null ? `${diff > 0 ? "+" : ""}${diff}m` : "—"}</span>
              </div>
              <div className="cs-mini-progress">
                <div
                  className="cs-mini-bar cs-bar-position"
                  style={{ width: `${positionScore}%` }}
                />
              </div>
            </div>

            <div className="cs-mini-metric">
              <div className="cs-mini-metric-head">
                <span className="cs-mini-label"><Wind size={11} /> 风定聚海度</span>
                <span className="cs-mini-val">{win.windSpeed != null ? `${win.windSpeed}m/s` : "—"}</span>
              </div>
              <div className="cs-mini-progress">
                <div
                  className="cs-mini-bar cs-bar-wind"
                  style={{ width: `${windScore}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. 山峰 vs 云层垂直剖面可视化标尺 (Elevation Profile Visualizer) */}
        <section className="cs-detail-card cs-elevation-card">
          <div className="cs-card-header">
            <div className="cs-card-title">
              <Layers size={14} className="cs-card-icon" />
              <span>山峰与云海垂直剖面剖析</span>
            </div>
            {diff != null && (
              <span className={`cs-diff-tag ${isAbove ? "is-above" : "is-below"}`}>
                落差 {diff > 0 ? `+${diff}` : diff}m
              </span>
            )}
          </div>

          <div className="cs-profile-diagram">
            {/* 顶层：山峰标高节点 */}
            <div className="cs-diag-node cs-diag-summit">
              <div className="cs-diag-mark cs-mark-summit">
                <Mountain size={14} />
              </div>
              <div className="cs-diag-info">
                <div className="cs-diag-title-row">
                  <span className="cs-diag-name">{site.name} 主峰标高</span>
                  <span className="cs-diag-tag">观景点</span>
                </div>
                <strong className="cs-diag-alt">{site.altitude} m</strong>
              </div>
            </div>

            {/* 中间落差指示带 */}
            <div className="cs-diag-gap-zone">
              <div className="cs-diag-gap-line" />
              <div className="cs-diag-gap-badge">
                {isAbove ? (
                  <>
                    <span className="cs-gap-indicator cs-gap-green">▲ 俯瞰通道开阔</span>
                    <span className="cs-gap-meta">山顶高出云顶 {diff}m，视野辽阔无遮挡</span>
                  </>
                ) : isIn ? (
                  <>
                    <span className="cs-gap-indicator cs-gap-orange">● 陷入云雾核心</span>
                    <span className="cs-gap-meta">山顶淹没在云海中，能见度较低</span>
                  </>
                ) : (
                  <>
                    <span className="cs-gap-indicator cs-gap-gray">▼ 处于云层底部</span>
                    <span className="cs-gap-meta">山顶低于云底，无法俯瞰成片云海</span>
                  </>
                )}
              </div>
            </div>

            {/* 云海波浪立体层 */}
            <div className="cs-diag-cloud-layer">
              <div className="cs-cloud-top-edge">
                <div className="cs-cloud-wave-label">
                  <Waves size={12} />
                  <span>预估云顶波面 (海平面)</span>
                </div>
                <strong className="cs-cloud-alt">{win.cloudTopM != null ? `${win.cloudTopM} m` : "—"}</strong>
              </div>

              <div className="cs-cloud-body-fill">
                <div className="cs-cloud-mist-bg" />
                <div className="cs-cloud-stats-inline">
                  <span>云层垂直估厚: <b>{cloudThickness != null ? `${cloudThickness}m` : "厚度待定"}</b></span>
                  <span>成海形态: <b>{isAbove ? "平流漫覆型" : "低空平伏型"}</b></span>
                </div>
              </div>

              <div className="cs-cloud-base-edge">
                <div className="cs-cloud-base-label">
                  <span className="cs-base-dot" />
                  <span>预估云底标高</span>
                </div>
                <span className="cs-cloud-base-alt">{win.cloudBaseM != null ? `${win.cloudBaseM} m` : "—"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 4. 高山成海气象因子 2x2 Bento 磁贴 */}
        <section className="cs-detail-card">
          <div className="cs-card-header">
            <div className="cs-card-title">
              <Wind size={14} className="cs-card-icon" />
              <span>高山成海气象条件</span>
            </div>
          </div>

          <div className="cs-bento-grid">
            {/* 湿度 */}
            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-moist"><Droplets size={14} /></span>
                <span className="cs-tile-title">近地面湿度</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number">{win.humidity != null ? `${win.humidity}%` : "—"}</strong>
                <span className={`cs-tile-pill ${((win.humidity ?? 0) >= 80) ? "pill-good" : ((win.humidity ?? 0) >= 65) ? "pill-normal" : "pill-warn"}`}>
                  {(win.humidity ?? 0) >= 80 ? "水汽充足" : (win.humidity ?? 0) >= 65 ? "湿度适中" : "偏干燥"}
                </span>
              </div>
              <span className="cs-tile-sub">下垫面水汽蒸腾供给</span>
            </div>

            {/* 风速 */}
            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-wind"><Wind size={14} /></span>
                <span className="cs-tile-title">近地风速</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number">{win.windSpeed != null ? `${win.windSpeed}m/s` : "—"}</strong>
                <span className={`cs-tile-pill ${(win.windSpeed ?? 0) <= 4 ? "pill-good" : (win.windSpeed ?? 0) <= 7 ? "pill-normal" : "pill-danger"}`}>
                  {(win.windSpeed ?? 0) <= 3.5 ? "微风平聚" : (win.windSpeed ?? 0) <= 7 ? "阵风翻浪" : "强风易散"}
                </span>
              </div>
              <span className="cs-tile-sub">微风更易维持平静云海</span>
            </div>

            {/* 日出时刻 */}
            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-sun"><Sun size={14} /></span>
                <span className="cs-tile-title">{phase === "morning" ? "日出时刻" : "日落时刻"}</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number cs-time-text">{targetSun?.timeStr ?? "—"}</strong>
                <span className="cs-tile-pill pill-gold">
                  <Sparkles size={11} /> 黄金光效
                </span>
              </div>
              <span className="cs-tile-sub">晨曦金光浸染云涛时刻</span>
            </div>

            {/* 日出方位角与微罗盘 */}
            <div className="cs-bento-tile cs-compass-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-compass"><Aperture size={14} /></span>
                <span className="cs-tile-title">机位方位角</span>
              </div>
              <CompassDial
                degree={targetSun?.azimuthDeg ?? 90}
                label={targetSun?.compass ?? "正东"}
              />
            </div>
          </div>
        </section>

        {/* 5. 摄影实战指南：装备、机位与拍摄参数 Blueprint */}
        <section className="cs-detail-card cs-blueprint-card">
          <div className="cs-card-header">
            <div className="cs-card-title">
              <Camera size={14} className="cs-card-icon" />
              <span>摄影实操方案 (Field Blueprint)</span>
            </div>
          </div>

          {/* 推荐观景点卡片 */}
          <div className="cs-viewpoint-spot">
            <div className="cs-spot-lead">
              <span className="cs-spot-badge">推荐机位</span>
              <strong className="cs-spot-name">{site.viewpoint}</strong>
            </div>
            <p className="cs-spot-desc">{site.description}</p>
          </div>

          {/* 摄影装备与参数速查芯片 */}
          <div className="cs-gear-grid">
            <div className="cs-gear-item">
              <span className="cs-gear-label">镜头配置</span>
              <strong className="cs-gear-value">超广角 14-24mm / 16-35mm</strong>
              <small className="cs-gear-tip">收纳漫无边际的云涛大场景接片</small>
            </div>
            <div className="cs-gear-item">
              <span className="cs-gear-label">慢门滤镜</span>
              <strong className="cs-gear-value">ND64 ~ ND1000 减光镜</strong>
              <small className="cs-gear-tip">曝光 10~30秒，雾化如绸缎般云流</small>
            </div>
            <div className="cs-gear-item">
              <span className="cs-gear-label">黄金时段</span>
              <strong className="cs-gear-value">日出前 40m 至日出后 25m</strong>
              <small className="cs-gear-tip">捕捉低角度暖金逆光穿透云絮</small>
            </div>
            <div className="cs-gear-item">
              <span className="cs-gear-label">拍摄机位朝向</span>
              <strong className="cs-gear-value">{targetSun?.compass ?? "东向"} ({targetSun?.azimuthDeg ?? 90}°)</strong>
              <small className="cs-gear-tip">对准日出方向支架提前占位构图</small>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
