"use client";

import { useMemo } from "react";
import {
  X,
  Flame,
  Sun,
  Sparkles,
  Camera,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type { FireGlowWindowScore } from "@/lib/fireglow";
import { calculateSiteSunEvents } from "@/lib/astroSunUtils";

interface FireglowSiteDetailProps {
  site: {
    id: string;
    name: string;
    province: string;
    latitude: number;
    longitude: number;
    altitude: number | null;
    window: FireGlowWindowScore;
  };
  phase: "morning" | "evening";
  dateKey: string;
  onClose: () => void;
}

/** 迷你罗盘微组件：绘制 360° 罗盘盘面及指针 */
function CompassDial({ degree = 270, label = "正西" }: { degree: number; label: string }) {
  const rotation = degree % 360;
  return (
    <div className="fg-compass-widget" title={`日落方位: ${degree}° (${label})`}>
      <svg viewBox="0 0 48 48" className="fg-compass-svg" aria-hidden="true">
        <circle cx="24" cy="24" r="21" className="fg-compass-outer-ring" />
        <circle cx="24" cy="24" r="17" className="fg-compass-inner-ring" />
        <text x="24" y="9" className="fg-compass-cardinal fg-north">N</text>
        <text x="39" y="27" className="fg-compass-cardinal">E</text>
        <text x="24" y="43" className="fg-compass-cardinal">S</text>
        <text x="9" y="27" className="fg-compass-cardinal">W</text>
        <g transform={`rotate(${rotation} 24 24)`}>
          <polygon points="24,10 21,24 27,24" className="fg-compass-arrow-sun" />
          <polygon points="24,38 21,24 27,24" className="fg-compass-arrow-tail" />
          <circle cx="24" cy="24" r="2.5" className="fg-compass-pivot" />
        </g>
      </svg>
      <div className="fg-compass-readout">
        <span className="fg-compass-deg">{degree}°</span>
        <span className="fg-compass-dir">{label}</span>
      </div>
    </div>
  );
}

export default function FireglowSiteDetail({
  site,
  phase,
  dateKey,
  onClose,
}: FireglowSiteDetailProps) {
  const win = site.window;
  const pLevel = win.probabilityLevel ?? "p20";

  // Calculate sun azimuth and events
  const sunEvents = useMemo(() => {
    return calculateSiteSunEvents(
      dateKey,
      site.latitude,
      site.longitude,
      site.altitude ?? 0,
    );
  }, [dateKey, site.latitude, site.longitude, site.altitude]);

  const targetSun = phase === "evening" ? sunEvents.sunset : sunEvents.sunrise;

  // Cloud layer values
  const high = win.highCloud ?? 0;
  const mid = win.midCloud ?? 0;
  const low = win.lowCloud ?? 0;

  // Vividness percentage
  const vividPct = Math.round((win.vividness ?? 0) * 100);

  // 地平通道状态
  const isChannelClear = low <= 20;
  const isChannelHazy = low > 20 && low <= 45;

  return (
    <aside className="fireglow-site-detail" aria-label={`${site.name}火烧云摄影详情`}>
      {/* 1. Header */}
      <div className="fg-detail-header">
        <div className="fg-detail-title-group">
          <div className="fg-detail-kicker-row">
            <span className="fg-province-chip">{site.province}</span>
            <span className="fg-alt-chip">
              {site.altitude == null ? "海拔估算" : `${Math.round(site.altitude)}m`}
            </span>
          </div>
          <h2 className="fg-detail-name">{site.name}</h2>
          <div className="fg-detail-coords">
            <span>{site.latitude.toFixed(2)}°N, {site.longitude.toFixed(2)}°E</span>
          </div>
        </div>
        <button
          type="button"
          className="fg-detail-close-btn"
          onClick={onClose}
          aria-label="关闭火烧云详情舱"
          title="关闭火烧云详情舱"
        >
          <X size={18} />
        </button>
      </div>

      <div className="fg-detail-scroll-content">
        {/* 2. 霞光条件指数与鲜艳度 Hero 卡片 */}
        <section className="fg-detail-card fg-hero-card">
          <div className="fg-hero-top">
            <div className="fg-hero-score-block">
              <span className="fg-hero-kicker">
                <Flame size={13} className="fg-flame-icon" /> 霞光条件指数
              </span>
              <div className="fg-hero-score-number" data-level={pLevel}>
                {win.probabilityLabel ?? "—"}
              </div>
            </div>
            <div className="fg-hero-badge-block">
              <span className="fg-band-pill" data-level={pLevel}>
                {win.bandLabel}
              </span>
              {win.momentLabel && (
                <span className="fg-moment-pill">
                  <Sparkles size={11} /> {win.momentLabel}
                </span>
              )}
            </div>
          </div>

          {/* 鲜艳度多段彩虹条 */}
          <div className="fg-vivid-strip">
            <div className="fg-vivid-head">
              <span className="fg-vivid-label">
                <Sparkles size={11} /> 霞光纯正鲜艳度
              </span>
              <span className="fg-vivid-val">
                <b>{win.vividness != null ? win.vividness.toFixed(2) : "—"}</b> / 1.00
              </span>
            </div>
            <div className="fg-vivid-track">
              <div
                className="fg-vivid-fill"
                style={{ width: `${Math.min(100, Math.max(8, vividPct))}%` }}
              />
            </div>
            <div className="fg-vivid-scale">
              <span>清淡</span>
              <span>饱和通透</span>
              <span>极度绚烂</span>
            </div>
          </div>
        </section>

        {/* 3. 摄影暮光天空光谱时间轴 (Twilight Spectrum Timeline) */}
        <section className="fg-detail-card fg-timeline-card">
          <div className="fg-card-header">
            <div className="fg-card-title">
              <Clock size={14} className="fg-card-icon" />
              <span>摄影暮光全光谱时序</span>
            </div>
            {win.peakTime && (
              <span className="fg-peak-tag">最佳爆发: {win.peakTime}</span>
            )}
          </div>

          {/* 暮光渐变光谱轴 */}
          <div className="fg-spectrum-timeline">
            <div className="fg-spectrum-bar" />
            <div className="fg-timeline-steps">
              {/* 日落时刻 */}
              <div className="fg-timeline-step">
                <div className="fg-step-node node-sunset" />
                <span className="fg-step-label">{phase === "evening" ? "日落时刻" : "日出时刻"}</span>
                <strong className="fg-step-time">{targetSun?.timeStr ?? "—"}</strong>
                <small className="fg-step-desc">地平直射金光</small>
              </div>

              {/* 金色时刻 */}
              <div className="fg-timeline-step">
                <div className="fg-step-node node-golden" />
                <span className="fg-step-label">金色时刻</span>
                <strong className="fg-step-time">{win.goldenTime ?? "—"}</strong>
                <small className="fg-step-desc">暖金泼洒云底</small>
              </div>

              {/* 蓝色时刻 */}
              <div className="fg-timeline-step">
                <div className="fg-step-node node-blue" />
                <span className="fg-step-label">蓝色时刻</span>
                <strong className="fg-step-time">{win.blueTime ?? "—"}</strong>
                <small className="fg-step-desc">冷暖强烈对冲</small>
              </div>

              {/* 天文昏影终 */}
              <div className="fg-timeline-step">
                <div className="fg-step-node node-astro" />
                <span className="fg-step-label">{phase === "evening" ? "昏影终" : "晨光始"}</span>
                <strong className="fg-step-time">{win.astroTime ?? "—"}</strong>
                <small className="fg-step-desc">深空暗夜开启</small>
              </div>
            </div>
          </div>

          {/* 机位日落朝向与微罗盘卡片 */}
          <div className="fg-sun-azimuth-card">
            <div className="fg-azimuth-info">
              <span className="fg-azimuth-label">
                <Sun size={12} className="fg-sun-icon" /> 镜头构图日落朝向
              </span>
              <strong className="fg-azimuth-heading">
                {targetSun?.compass ?? "正西"} · {targetSun?.azimuthDeg ?? 270}°
              </strong>
              <small className="fg-azimuth-tip">地平线太阳浸落基准方向</small>
            </div>
            <CompassDial
              degree={targetSun?.azimuthDeg ?? 270}
              label={targetSun?.compass ?? "正西"}
            />
          </div>
        </section>

        {/* 4. 大气云层画布与透光通道立体剖析 */}
        <section className="fg-detail-card fg-canvas-card">
          <div className="fg-card-header">
            <div className="fg-card-title">
              <Layers size={14} className="fg-card-icon" />
              <span>大气三层云量画布与透光通道</span>
            </div>
          </div>

          <div className="fg-cloud-bars-list">
            {/* 高云 */}
            <div className="fg-cloud-row">
              <div className="fg-cloud-meta">
                <div className="fg-cloud-type">
                  <span className="fg-cloud-dot dot-high" />
                  <span className="fg-cloud-name">高云 (6000m+)</span>
                  <span className="fg-cloud-role">反射漫射画布 (x0.75)</span>
                </div>
                <strong className="fg-cloud-percent">{high}%</strong>
              </div>
              <div className="fg-cloud-track">
                <div className="fg-cloud-bar bar-high" style={{ width: `${high}%` }} />
              </div>
            </div>

            {/* 中云 */}
            <div className="fg-cloud-row">
              <div className="fg-cloud-meta">
                <div className="fg-cloud-type">
                  <span className="fg-cloud-dot dot-mid" />
                  <span className="fg-cloud-name">中云 (2000-6000m)</span>
                  <span className="fg-cloud-role">烈焰层次过渡 (x0.45)</span>
                </div>
                <strong className="fg-cloud-percent">{mid}%</strong>
              </div>
              <div className="fg-cloud-track">
                <div className="fg-cloud-bar bar-mid" style={{ width: `${mid}%` }} />
              </div>
            </div>

            {/* 低云 */}
            <div className="fg-cloud-row">
              <div className="fg-cloud-meta">
                <div className="fg-cloud-type">
                  <span className="fg-cloud-dot dot-low" />
                  <span className="fg-cloud-name">低云 (&lt;2000m)</span>
                  <span className="fg-cloud-role">地平遮挡阻力层</span>
                </div>
                <strong className="fg-cloud-percent">{low}%</strong>
              </div>
              <div className="fg-cloud-track">
                <div className="fg-cloud-bar bar-low" style={{ width: `${low}%` }} />
              </div>
            </div>
          </div>

          {/* 地平通道判定胶囊条 */}
          <div className={`fg-horizon-channel ${isChannelClear ? "channel-clear" : isChannelHazy ? "channel-hazy" : "channel-blocked"}`}>
            {isChannelClear ? (
              <>
                <CheckCircle2 size={14} className="fg-channel-icon text-good" />
                <div className="fg-channel-copy">
                  <strong>地平天光通道畅通通透</strong>
                  <span>夕阳光线可直射照射至头顶高云/中云底，反射极其鲜亮</span>
                </div>
              </>
            ) : isChannelHazy ? (
              <>
                <AlertCircle size={14} className="fg-channel-icon text-warn" />
                <div className="fg-channel-copy">
                  <strong>地平线存在薄低云层 (遮挡 {low}%)</strong>
                  <span>部分光线发生弥散漫射，建议提前架机抢拍金光瞬间</span>
                </div>
              </>
            ) : (
              <>
                <AlertCircle size={14} className="fg-channel-icon text-danger" />
                <div className="fg-channel-copy">
                  <strong>地平线低云封死通道 (遮挡 {low}%)</strong>
                  <span>夕阳在落山前容易被低云提前吞噬，需留意云隙漏光</span>
                </div>
              </>
            )}
          </div>
        </section>

        {/* 5. 摄影实战方案 Blueprint */}
        <section className="fg-detail-card fg-blueprint-card">
          <div className="fg-card-header">
            <div className="fg-card-title">
              <Camera size={14} className="fg-card-icon" />
              <span>摄影实战机位指南 (Field Blueprint)</span>
            </div>
          </div>

          <div className="fg-gear-grid">
            <div className="fg-gear-item">
              <span className="fg-gear-label">镜头焦段配置</span>
              <strong className="fg-gear-value">广角 16-35mm / 24-70mm</strong>
              <small className="fg-gear-tip">收纳漫天烧红高云天际大场景</small>
            </div>
            <div className="fg-gear-item">
              <span className="fg-gear-label">推荐滤镜搭配</span>
              <strong className="fg-gear-value">GND 0.9 软渐变中灰滤镜</strong>
              <small className="fg-gear-tip">压暗亮部天光，提亮地面暗部地景</small>
            </div>
            <div className="fg-gear-item">
              <span className="fg-gear-label">镜头取景朝向</span>
              <strong className="fg-gear-value">{targetSun?.compass ?? "正西"} ({targetSun?.azimuthDeg ?? 270}°)</strong>
              <small className="fg-gear-tip">对准夕阳余晖主反射中心轴</small>
            </div>
            <div className="fg-gear-item">
              <span className="fg-gear-label">撤机时机提醒</span>
              <strong className="fg-gear-value">日落后 20-30 分钟</strong>
              <small className="fg-gear-tip">高云粉紫漫射最绚烂期，切莫过早收机</small>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
