"use client";

import { useMemo } from "react";
import { X, Mountain, Waves, Wind, Droplets, Sun, Compass, Camera, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertTriangle, CloudFog } from "lucide-react";
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

  // Photography advice generation
  const advice = useMemo(() => {
    const lines: string[] = [];

    if (isAbove) {
      if (diff != null && diff >= 200) {
        lines.push(`山顶高出预估云顶 ${diff}m，视野俯瞰高度极佳，不仅能拍到浩瀚如海的平静云涛，山峰若隐若现亦极具层次感。`);
      } else {
        lines.push("山顶略高于云顶，云雾将掠过脚下山脊，适合近景慢门拉丝拍摄瀑布云流。");
      }
    } else if (isIn) {
      lines.push("山顶目前处于云层内部，能见度受大雾影响较低，建议等待风力驱散或云层下沉窗口再架机。");
    } else if (isBelow) {
      lines.push("山顶标高低于云底，处于阴天多云状态，无法俯瞰云顶，建议前往更高海拔观景台。");
    } else {
      lines.push("当前气温与湿度下整层晴朗少云，适宜拍摄名山巍峨全景。");
    }

    if (win.windSpeed != null) {
      if (win.windSpeed <= 3.5) {
        lines.push("近地风力轻柔(微风)，云层聚拢平缓稳定，极易维持如镜面般的壮观平流云海。");
      } else if (win.windSpeed <= 7) {
        lines.push("近地风力中等，云雾移动迅速，适合通过延时摄影拍摄云浪翻腾与瀑布云。");
      } else {
        lines.push("近地风速较大(>7m/s)，云层可能较快被撕裂吹散，需抓拍瞬息万变的瞬间。");
      }
    }

    if (targetSun) {
      lines.push(`晨昏${phase === "morning" ? "日出" : "日落"}方位角为 ${targetSun.azimuthLabel}，建议提前 40 分钟占据 ${site.viewpoint} 朝向，使用超广角接片或长焦压缩远方云海群山。`);
    }

    return lines.join(" ");
  }, [isAbove, isIn, isBelow, diff, win.windSpeed, targetSun, phase, site.viewpoint]);

  return (
    <aside className="cloudsea-site-detail" aria-label={`${site.name}云海摄影详情`}>
      {/* 1. Header */}
      <div className="cs-detail-header">
        <div className="cs-detail-title-group">
          <span className="cs-detail-kicker">
            {site.province} · {site.area}
          </span>
          <h2 className="cs-detail-name">{site.name}</h2>
          <span className="cs-detail-coords">
            海拔 {site.altitude}m · {site.latitude.toFixed(3)}°N, {site.longitude.toFixed(3)}°E
          </span>
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
        {/* 2. Main Probability & Position Badge */}
        <section className="cs-detail-card cs-primary-card">
          <div className="cs-score-top-row">
            <div className="cs-score-box">
              <span className="cs-score-kicker">云海综合概率</span>
              <div className="cs-score-main-val" data-level={pLevel}>
                <Waves size={20} className="waves-icon" />
                <span>{win.probabilityLabel ?? "—"}</span>
              </div>
            </div>
            <span className={`cs-pos-pill ${badgeTone}`}>
              {win.cloudPosition === "above" && <CheckCircle2 size={13} />}
              {win.cloudPosition === "in" && <CloudFog size={13} />}
              {win.cloudPosition === "below" && <AlertTriangle size={13} />}
              <span>{win.positionLabel}</span>
            </span>
          </div>

          <p className="cs-card-summary">{win.summary}</p>
        </section>

        {/* 3. Mountain Summit vs Cloud Layer Profile (垂直高差矩阵) */}
        <section className="cs-detail-card">
          <div className="cs-detail-card-title">
            <Mountain size={15} className="cs-section-icon" />
            <span>山峰海拔与云层垂直高差</span>
          </div>

          <div className="cs-profile-matrix">
            <div className="cs-matrix-item highlight-matrix">
              <span className="cs-matrix-label">
                {isAbove ? <ArrowUpRight size={13} className="text-good" /> : <ArrowDownRight size={13} className="text-bad" />}
                <span>相对云顶落差</span>
              </span>
              <strong className={`cs-matrix-val ${isAbove ? "val-good" : "val-warn"}`}>
                {diff != null ? `${diff > 0 ? "+" : ""}${diff} m` : "—"}
              </strong>
              <small className="cs-matrix-hint">
                {isAbove ? "山顶刺破云顶 · 俯瞰通透" : isIn ? "山顶处于云中 · 大雾受阻" : "山顶处于云下 · 阴沉无海"}
              </small>
            </div>

            <div className="cs-matrix-item">
              <span className="cs-matrix-label">山峰顶海拔</span>
              <strong className="cs-matrix-val">{site.altitude} m</strong>
              <small className="cs-matrix-hint">主峰/观景台标高</small>
            </div>

            <div className="cs-matrix-item">
              <span className="cs-matrix-label">预估云顶标高</span>
              <strong className="cs-matrix-val">{win.cloudTopM != null ? `${win.cloudTopM} m` : "—"}</strong>
              <small className="cs-matrix-hint">云海波涛最高海平面</small>
            </div>

            <div className="cs-matrix-item">
              <span className="cs-matrix-label">预估云底标高</span>
              <strong className="cs-matrix-val">{win.cloudBaseM != null ? `${win.cloudBaseM} m` : "—"}</strong>
              <small className="cs-matrix-hint">高山低云层底位置</small>
            </div>
          </div>
        </section>

        {/* 4. Meteorological Formation Conditions (成海气象条件) */}
        <section className="cs-detail-card">
          <div className="cs-detail-card-title">
            <Wind size={15} className="cs-section-icon" />
            <span>高山成海气象因子</span>
          </div>

          <div className="cs-weather-grid">
            <div className="cs-weather-item">
              <span className="cs-weather-label">
                <Droplets size={13} />
                <span>近地面湿度</span>
              </span>
              <strong className="cs-weather-val">{win.humidity != null ? `${win.humidity}%` : "—"}</strong>
              <span className="cs-weather-status">
                {(win.humidity ?? 0) >= 85 ? "水汽充沛 · 极佳" : (win.humidity ?? 0) >= 70 ? "水汽良好" : "偏干"}
              </span>
            </div>

            <div className="cs-weather-item">
              <span className="cs-weather-label">
                <Wind size={13} />
                <span>近地风速</span>
              </span>
              <strong className="cs-weather-val">{win.windSpeed != null ? `${win.windSpeed} m/s` : "—"}</strong>
              <span className="cs-weather-status">
                {(win.windSpeed ?? 0) <= 3.5 ? "微风 · 易聚不易散" : (win.windSpeed ?? 0) <= 7 ? "阵风 · 翻腾瀑布云" : "强风"}
              </span>
            </div>

            <div className="cs-weather-item">
              <span className="cs-weather-label">
                <Sun size={13} />
                <span>{phase === "morning" ? "日出时刻" : "日落时刻"}</span>
              </span>
              <strong className="cs-weather-val">{targetSun?.timeStr ?? "—"}</strong>
              <span className="cs-weather-status">最佳金光穿云时段</span>
            </div>

            <div className="cs-weather-item">
              <span className="cs-weather-label">
                <Compass size={13} />
                <span>机位日出朝向</span>
              </span>
              <strong className="cs-weather-val">{targetSun?.azimuthLabel ?? "—"}</strong>
              <span className="cs-weather-status">太阳升落方位</span>
            </div>
          </div>
        </section>

        {/* 5. Classic Viewpoint & Photography Advice */}
        <section className="cs-detail-card cs-advice-card">
          <div className="cs-detail-card-title">
            <Camera size={15} className="cs-section-icon" />
            <span>经典机位与拍摄指南</span>
          </div>

          <div className="cs-viewpoint-box">
            <span className="cs-viewpoint-label">推荐观景机位:</span>
            <strong className="cs-viewpoint-name">{site.viewpoint}</strong>
          </div>

          <p className="cs-description-text">{site.description}</p>
          <div className="cs-advice-divider" />
          <p className="cs-advice-text">{advice}</p>
        </section>
      </div>
    </aside>
  );
}
