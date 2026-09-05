"use client";

import { useMemo } from "react";
import { X, Flame, Sun, Compass, Sparkles, Cloud, Eye, Camera, Clock } from "lucide-react";
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

  // Photography advice generation
  const advice = useMemo(() => {
    const lines: string[] = [];
    if (low <= 15) {
      lines.push("地平线低云少，夕阳透光通道畅通，适宜捕捉金光洒向高云/中云的完整反光过程。");
    } else if (low <= 35) {
      lines.push("地平线存在少量低云，可能提前数分钟遮挡直射阳光，建议提前架机拍摄。");
    } else {
      lines.push("地平线低云偏多，可能阻断夕阳光芒，出片需抓住云缝漏光瞬间。");
    }

    if (mid >= 40 && mid <= 80) {
      lines.push("中云云层分布理想，极易形成火红/深橙色大面积泼血燃烧效果。");
    } else if (high >= 40) {
      lines.push("高云丰富，日落后 15-25 分钟将呈现粉紫漫射冷暖渐变，不可过早收机。");
    }

    if (targetSun?.compass) {
      lines.push(`建议机位朝向 ${targetSun.compass} (${targetSun.azimuthDeg}°) 开阔视野，推荐广角镜头搭配 GND 中灰渐变镜平衡光比。`);
    }

    return lines.join(" ");
  }, [low, mid, high, targetSun]);

  return (
    <aside className="fireglow-site-detail" aria-label={`${site.name}火烧云摄影详情`}>
      {/* 1. Header */}
      <div className="detail-header">
        <div className="detail-title-group">
          <span className="detail-kicker">
            {site.province} · {site.altitude == null ? "海拔估算" : `${Math.round(site.altitude)}m`}
          </span>
          <h2 className="detail-name">{site.name}</h2>
          <span className="detail-coords">
            {site.latitude.toFixed(3)}°N, {site.longitude.toFixed(3)}°E
          </span>
        </div>
        <button
          type="button"
          className="detail-close-btn"
          onClick={onClose}
          aria-label="关闭详情舱"
          title="关闭详情舱"
        >
          <X size={18} />
        </button>
      </div>

      <div className="detail-scroll-content">
        {/* 2. Main Probability & Vividness Card */}
        <section className="detail-card primary-score-card">
          <div className="score-top-row">
            <div className="score-badge-box">
              <span className="score-kicker">霞光爆发概率</span>
              <div className="score-main-val" data-level={pLevel}>
                <Flame size={20} className="flame-icon" />
                <span>{win.probabilityLabel ?? "—"}</span>
              </div>
            </div>
            <span className="band-tag" data-level={pLevel}>
              {win.bandLabel}
            </span>
          </div>

          {/* Vividness Progress Bar */}
          <div className="vividness-box">
            <div className="vividness-labels">
              <span>霞光鲜艳度</span>
              <strong>{win.vividness != null ? win.vividness.toFixed(2) : "—"}</strong>
            </div>
            <div className="vividness-bar-bg">
              <div
                className="vividness-bar-fill"
                style={{ width: `${Math.min(100, Math.max(0, vividPct))}%` }}
              />
            </div>
          </div>

          {win.momentLabel && (
            <div className="moment-tag-pill">
              <Sparkles size={12} />
              <span>{win.momentLabel} · 最佳 {win.peakTime ?? "—"}</span>
            </div>
          )}
        </section>

        {/* 3. Solar & Twilight Timeline (摄影天象时刻表) */}
        <section className="detail-card">
          <div className="detail-card-title">
            <Sun size={15} className="section-icon" />
            <span>太阳与摄影暮光时段</span>
          </div>

          <div className="twilight-grid">
            {/* Azimuth / Direction */}
            <div className="twilight-item highlight-item">
              <span className="twilight-label">
                <Compass size={12} />
                <span>{phase === "evening" ? "日落机位朝向" : "日出机位朝向"}</span>
              </span>
              <strong className="twilight-val">
                {targetSun?.azimuthLabel ?? "—"}
              </strong>
            </div>

            <div className="twilight-item">
              <span className="twilight-label">
                <Clock size={12} />
                <span>{phase === "evening" ? "日落时刻" : "日出时刻"}</span>
              </span>
              <strong className="twilight-val">
                {targetSun?.timeStr ?? "—"}
              </strong>
            </div>

            <div className="twilight-item">
              <span className="twilight-label">
                <span className="dot dot-golden" />
                <span>金色时刻 (Golden)</span>
              </span>
              <strong className="twilight-val">
                {win.goldenTime ?? (phase === "evening" ? sunEvents.goldenHourEvening : sunEvents.goldenHourMorning) ?? "—"}
              </strong>
            </div>

            <div className="twilight-item">
              <span className="twilight-label">
                <span className="dot dot-blue" />
                <span>蓝色时刻 (Blue)</span>
              </span>
              <strong className="twilight-val">
                {win.blueTime ?? (phase === "evening" ? sunEvents.blueHourEvening : sunEvents.blueHourMorning) ?? "—"}
              </strong>
            </div>

            <div className="twilight-item">
              <span className="twilight-label">
                <span className="dot dot-astro" />
                <span>天文{phase === "evening" ? "昏影终" : "晨光始"}</span>
              </span>
              <strong className="twilight-val">
                {win.astroTime ?? "—"}
              </strong>
            </div>

            <div className="twilight-item">
              <span className="twilight-label">
                <Eye size={12} />
                <span>水平能见度</span>
              </span>
              <strong className="twilight-val">
                {win.visibilityKm != null ? `${win.visibilityKm} km` : "—"}
              </strong>
            </div>
          </div>
        </section>

        {/* 4. Cloud Canvas Breakdown (云层画布结构) */}
        <section className="detail-card">
          <div className="detail-card-title">
            <Cloud size={15} className="section-icon" />
            <span>云层画布分层 (反射与遮蔽)</span>
          </div>

          <div className="cloud-bars-container">
            {/* High Cloud */}
            <div className="cloud-bar-row">
              <div className="cloud-bar-head">
                <span className="cloud-type-name">高云 (6000m+)</span>
                <span className="cloud-type-pct">{high}%</span>
              </div>
              <div className="cloud-bar-track">
                <div className="cloud-bar-fill fill-high" style={{ width: `${Math.min(100, high)}%` }} />
              </div>
              <span className="cloud-bar-desc">反射粉紫色漫射霞光，权重 ×0.75</span>
            </div>

            {/* Mid Cloud */}
            <div className="cloud-bar-row">
              <div className="cloud-bar-head">
                <span className="cloud-type-name">中云 (2000-6000m)</span>
                <span className="cloud-type-pct">{mid}%</span>
              </div>
              <div className="cloud-bar-track">
                <div className="cloud-bar-fill fill-mid" style={{ width: `${Math.min(100, mid)}%` }} />
              </div>
              <span className="cloud-bar-desc">呈现深红/橙红燃烧效果，权重 ×0.45</span>
            </div>

            {/* Low Cloud */}
            <div className="cloud-bar-row">
              <div className="cloud-bar-head">
                <span className="cloud-type-name">低云 (&lt;2000m)</span>
                <span className="cloud-type-pct">{low}%</span>
              </div>
              <div className="cloud-bar-track">
                <div className="cloud-bar-fill fill-low" style={{ width: `${Math.min(100, low)}%` }} />
              </div>
              <span className="cloud-bar-desc">易遮挡地平线天光通道，过厚则封死霞光</span>
            </div>
          </div>

          {/* Horizon Blocking Status Badge */}
          <div className="horizon-status-box">
            <span className="horizon-status-label">地平通道判定:</span>
            <span className={`horizon-status-badge ${low <= 20 ? "status-pass" : low <= 40 ? "status-warn" : "status-block"}`}>
              {low <= 20 ? "✓ 通道开阔通透" : low <= 40 ? "⚠ 局部遮挡" : "✕ 低云严重遮蔽"}
            </span>
          </div>
        </section>

        {/* 5. Photography Advice Card */}
        <section className="detail-card advice-card">
          <div className="detail-card-title">
            <Camera size={15} className="section-icon" />
            <span>摄影实拍机位研判</span>
          </div>
          <p className="advice-text">{advice}</p>
        </section>
      </div>
    </aside>
  );
}
