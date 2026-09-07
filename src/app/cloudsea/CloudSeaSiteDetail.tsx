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

function CompassDial({
  degree = 0,
  label = "",
}: {
  degree: number;
  label: string;
}) {
  const rotation = degree % 360;
  return (
    <div
      className="cs-compass-widget"
      title={`太阳方位: ${degree}° (${label})`}
    >
      <svg
        viewBox="0 0 48 48"
        className="cs-compass-svg"
        aria-hidden="true"
      >
        <circle cx="24" cy="24" r="21" className="cs-compass-outer-ring" />
        <circle cx="24" cy="24" r="17" className="cs-compass-inner-ring" />
        <text x="24" y="9" className="cs-compass-cardinal cs-north">
          N
        </text>
        <text x="39" y="27" className="cs-compass-cardinal">
          E
        </text>
        <text x="24" y="43" className="cs-compass-cardinal">
          S
        </text>
        <text x="9" y="27" className="cs-compass-cardinal">
          W
        </text>
        <g transform={`rotate(${rotation} 24 24)`}>
          <polygon
            points="24,10 21,24 27,24"
            className="cs-compass-arrow-north"
          />
          <polygon
            points="24,38 21,24 27,24"
            className="cs-compass-arrow-south"
          />
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

function inversionStrengthLabel(
  strength: CloudSeaWindowScore["inversion"]["strength"],
): string {
  if (strength === "strong") return "较强";
  if (strength === "moderate") return "中等";
  if (strength === "weak") return "较弱";
  return "—";
}

export default function CloudSeaSiteDetail({
  site,
  window: win,
  phase,
  dateKey,
  onClose,
}: CloudSeaSiteDetailProps) {
  const pLevel = win.conditionLevel ?? "p20";
  const badgeTone = positionBadgeTone(win.cloudPosition);

  const sunEvents = useMemo(
    () =>
      calculateSiteSunEvents(
        dateKey,
        site.latitude,
        site.longitude,
        site.altitude,
      ),
    [dateKey, site.latitude, site.longitude, site.altitude],
  );

  const targetSun = phase === "morning" ? sunEvents.sunrise : sunEvents.sunset;
  const solarEventLabel = phase === "morning" ? "日出" : "日落";
  const fallbackAzimuth = phase === "morning" ? 90 : 270;
  const fallbackCompass = phase === "morning" ? "正东" : "正西";

  const diff = win.altitudeDiffM;
  const isAbove = win.cloudPosition === "above";
  const isIn = win.cloudPosition === "in";
  const isBelow = win.cloudPosition === "below";
  const isClear = win.cloudPosition === "clear";
  const pressureUnavailable = win.pressureStatus === "unavailable";

  const cloudThickness = useMemo(() => {
    if (
      win.cloudTopM != null &&
      win.cloudBaseM != null &&
      win.cloudTopM >= win.cloudBaseM
    ) {
      return win.cloudTopM - win.cloudBaseM;
    }
    return null;
  }, [win.cloudTopM, win.cloudBaseM]);

  const moistureScore =
    win.humidity == null
      ? 0
      : Math.min(100, Math.max(0, Math.round((win.humidity / 95) * 100)));
  const windScore =
    win.windSpeed == null
      ? 0
      : Math.max(
          0,
          Math.min(
            100,
            Math.round((1 - Math.min(win.windSpeed, 12) / 14) * 100),
          ),
        );
  const positionScore = isAbove
    ? 95
    : isIn
      ? 35
      : isBelow
        ? 20
        : isClear
          ? 10
          : 0;

  const positionHint = isAbove
    ? "压力层证据：山顶在低层云 deck 上方"
    : isIn
      ? "压力层证据：山顶落在低层云 deck 内"
      : isBelow
        ? "压力层证据：山顶位于低层云 deck 下方"
        : isClear
          ? "surface 低云偏少 · 暂无明显云海条件"
          : pressureUnavailable
            ? "压力剖面不足 · 不推断垂直层位"
            : "压力层未定位连续低云 deck · 暂不推断";

  const pressureTimeLabel = win.pressureTime?.slice(11, 16) ?? "—";
  const inversionText =
    win.inversion.status === "detected"
      ? `${inversionStrengthLabel(win.inversion.strength)}逆温 · +${win.inversion.deltaTempC}°C`
      : win.inversion.status === "not-detected"
        ? "未检测到明确逆温"
        : "逆温证据不足";
  const inversionRange =
    win.inversion.status === "detected" &&
    win.inversion.lowerMsl != null &&
    win.inversion.upperMsl != null
      ? `${win.inversion.lowerMsl}–${win.inversion.upperMsl}m`
      : "数值模式相邻压力层";

  return (
    <aside
      className="cloudsea-site-detail"
      aria-label={`${site.name}云海摄影详情`}
    >
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
            <span>
              {site.latitude.toFixed(2)}°N, {site.longitude.toFixed(2)}°E
            </span>
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
        <p className="cs-beta-note">
          Beta · surface 湿度/风来自 Open-Meteo；云底、云顶、山顶关系与逆温为压力层数值模式推导，不是探空/现场云底仪实测；条件指数仍未做长期实拍事件概率校准。
        </p>

        <section className="cs-detail-card cs-hero-card">
          <div className="cs-hero-top">
            <div className="cs-hero-score-block">
              <span className="cs-hero-kicker">
                <Waves size={13} className="cs-wave-icon" /> 云海条件指数
              </span>
              <div className="cs-hero-score-number" data-level={pLevel}>
                {win.conditionLabel ?? "—"}
              </div>
            </div>
            <div className="cs-hero-badge-block">
              <span className={`cs-pos-pill ${badgeTone}`}>
                {isAbove && <CheckCircle2 size={13} />}
                {isIn && <CloudFog size={13} />}
                {isBelow && <AlertTriangle size={13} />}
                <span>{win.positionLabel}</span>
              </span>
              <span className="cs-summary-hint">{positionHint}</span>
            </div>
          </div>

          <div className="cs-hero-metrics-strip">
            <div className="cs-mini-metric">
              <div className="cs-mini-metric-head">
                <span className="cs-mini-label">
                  <Droplets size={11} /> 近地湿度水平
                </span>
                <span className="cs-mini-val">
                  {win.humidity != null ? `${win.humidity}%` : "—"}
                </span>
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
                <span className="cs-mini-label">
                  <Mountain size={11} /> 模式层位落差
                </span>
                <span className="cs-mini-val">
                  {diff != null ? `${diff > 0 ? "+" : ""}${diff}m` : "—"}
                </span>
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
                <span className="cs-mini-label">
                  <Wind size={11} /> 风力稳定度
                </span>
                <span className="cs-mini-val">
                  {win.windSpeed != null ? `${win.windSpeed}m/s` : "—"}
                </span>
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

        <section className="cs-detail-card cs-elevation-card">
          <div className="cs-card-header">
            <div className="cs-card-title">
              <Layers size={14} className="cs-card-icon" />
              <span>数值模式垂直云层证据</span>
            </div>
            {diff != null && (
              <span
                className={`cs-diff-tag ${isAbove ? "is-above" : "is-below"}`}
              >
                峰顶-云顶 {diff > 0 ? `+${diff}` : diff}m
              </span>
            )}
          </div>

          <div className="cs-profile-diagram">
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

            <div className="cs-diag-gap-zone">
              <div className="cs-diag-gap-line" />
              <div className="cs-diag-gap-badge">
                {isAbove ? (
                  <>
                    <span className="cs-gap-indicator cs-gap-green">
                      ▲ 压力层显示山顶在云层上方
                    </span>
                    <span className="cs-gap-meta">
                      山顶高出模式云顶 {diff}m；最佳剖面时次 {pressureTimeLabel}
                    </span>
                  </>
                ) : isIn ? (
                  <>
                    <span className="cs-gap-indicator cs-gap-orange">
                      ● 压力层显示山顶处于云层内
                    </span>
                    <span className="cs-gap-meta">
                      存在云雾包裹风险，实际能见度仍需临近复核
                    </span>
                  </>
                ) : isBelow ? (
                  <>
                    <span className="cs-gap-indicator cs-gap-gray">
                      ▼ 压力层显示山顶位于云层下方
                    </span>
                    <span className="cs-gap-meta">
                      当前模式层位不利于从峰顶俯瞰成片云海
                    </span>
                  </>
                ) : isClear ? (
                  <>
                    <span className="cs-gap-indicator cs-gap-gray">
                      ○ surface 低云条件不足
                    </span>
                    <span className="cs-gap-meta">
                      低云偏少，因此不显示没有实际意义的云底/云顶
                    </span>
                  </>
                ) : (
                  <>
                    <span className="cs-gap-indicator cs-gap-gray">
                      — 垂直层位证据不足
                    </span>
                    <span className="cs-gap-meta">
                      pressure profile 不足时不使用启发式云底补算
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="cs-diag-cloud-layer">
              <div className="cs-cloud-top-edge">
                <div className="cs-cloud-wave-label">
                  <Waves size={12} />
                  <span>压力层云顶 (MSL)</span>
                </div>
                <strong className="cs-cloud-alt">
                  {win.cloudTopM != null ? `${win.cloudTopM} m` : "—"}
                </strong>
              </div>

              <div className="cs-cloud-body-fill">
                <div className="cs-cloud-mist-bg" />
                <div className="cs-cloud-stats-inline">
                  <span>
                    模式层厚: <b>{cloudThickness != null ? `${cloudThickness}m` : "—"}</b>
                  </span>
                  <span>
                    层位判断: <b>{win.positionLabel}</b>
                  </span>
                  <span>
                    剖面置信度: <b>{win.pressureConfidence ?? "—"}</b>
                  </span>
                </div>
              </div>

              <div className="cs-cloud-base-edge">
                <div className="cs-cloud-base-label">
                  <span className="cs-base-dot" />
                  <span>压力层云底 (MSL)</span>
                </div>
                <span className="cs-cloud-base-alt">
                  {win.cloudBaseM != null ? `${win.cloudBaseM} m` : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="cs-detail-card">
          <div className="cs-card-header">
            <div className="cs-card-title">
              <Wind size={14} className="cs-card-icon" />
              <span>高山成海气象条件</span>
            </div>
          </div>

          <div className="cs-bento-grid">
            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-moist">
                  <Droplets size={14} />
                </span>
                <span className="cs-tile-title">近地面湿度</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number">
                  {win.humidity != null ? `${win.humidity}%` : "—"}
                </strong>
                <span
                  className={`cs-tile-pill ${
                    (win.humidity ?? 0) >= 80
                      ? "pill-good"
                      : (win.humidity ?? 0) >= 65
                        ? "pill-normal"
                        : "pill-warn"
                  }`}
                >
                  {win.humidity == null
                    ? "数据不足"
                    : win.humidity >= 80
                      ? "水汽充足"
                      : win.humidity >= 65
                        ? "湿度适中"
                        : "偏干燥"}
                </span>
              </div>
              <span className="cs-tile-sub">Open-Meteo 2 米相对湿度</span>
            </div>

            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-wind">
                  <Wind size={14} />
                </span>
                <span className="cs-tile-title">近地风速</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number">
                  {win.windSpeed != null ? `${win.windSpeed}m/s` : "—"}
                </strong>
                <span
                  className={`cs-tile-pill ${
                    (win.windSpeed ?? 0) <= 4
                      ? "pill-good"
                      : (win.windSpeed ?? 0) <= 7
                        ? "pill-normal"
                        : "pill-danger"
                  }`}
                >
                  {win.windSpeed == null
                    ? "数据不足"
                    : win.windSpeed <= 3.5
                      ? "微风平聚"
                      : win.windSpeed <= 7
                        ? "阵风翻浪"
                        : "强风易散"}
                </span>
              </div>
              <span className="cs-tile-sub">
                微风通常更利于维持低层云体
              </span>
            </div>

            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-moist">
                  <Layers size={14} />
                </span>
                <span className="cs-tile-title">逆温证据</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number cs-time-text">
                  {inversionText}
                </strong>
                <span
                  className={`cs-tile-pill ${
                    win.inversion.status === "detected"
                      ? "pill-good"
                      : win.inversion.status === "not-detected"
                        ? "pill-normal"
                        : "pill-warn"
                  }`}
                >
                  {win.inversion.status === "detected"
                    ? "模式证据"
                    : win.inversion.status === "not-detected"
                      ? "未检出"
                      : "数据不足"}
                </span>
              </div>
              <span className="cs-tile-sub">{inversionRange} · 非探空实测</span>
            </div>

            <div className="cs-bento-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-sun">
                  <Sun size={14} />
                </span>
                <span className="cs-tile-title">{solarEventLabel}时刻</span>
              </div>
              <div className="cs-tile-main">
                <strong className="cs-tile-number cs-time-text">
                  {targetSun?.timeStr ?? "—"}
                </strong>
                <span className="cs-tile-pill pill-gold">
                  <Sparkles size={11} /> 黄金光效
                </span>
              </div>
              <span className="cs-tile-sub">
                {phase === "morning"
                  ? "晨曦低角度暖光参考"
                  : "暮光低角度暖光参考"}
              </span>
            </div>

            <div className="cs-bento-tile cs-compass-tile">
              <div className="cs-tile-head">
                <span className="cs-tile-icon cs-icon-compass">
                  <Aperture size={14} />
                </span>
                <span className="cs-tile-title">机位方位角</span>
              </div>
              <CompassDial
                degree={targetSun?.azimuthDeg ?? fallbackAzimuth}
                label={targetSun?.compass ?? fallbackCompass}
              />
            </div>
          </div>
        </section>

        <section className="cs-detail-card cs-blueprint-card">
          <div className="cs-card-header">
            <div className="cs-card-title">
              <Camera size={14} className="cs-card-icon" />
              <span>摄影实操方案 (Field Blueprint)</span>
            </div>
          </div>

          <div className="cs-viewpoint-spot">
            <div className="cs-spot-lead">
              <span className="cs-spot-badge">推荐机位</span>
              <strong className="cs-spot-name">{site.viewpoint}</strong>
            </div>
            <p className="cs-spot-desc">{site.description}</p>
          </div>

          <div className="cs-gear-grid">
            <div className="cs-gear-item">
              <span className="cs-gear-label">镜头配置</span>
              <strong className="cs-gear-value">
                超广角 14-24mm / 16-35mm
              </strong>
              <small className="cs-gear-tip">
                适合大范围云层与山体关系构图
              </small>
            </div>
            <div className="cs-gear-item">
              <span className="cs-gear-label">慢门滤镜</span>
              <strong className="cs-gear-value">ND64 ~ ND1000 减光镜</strong>
              <small className="cs-gear-tip">
                按现场亮度决定是否使用长曝光
              </small>
            </div>
            <div className="cs-gear-item">
              <span className="cs-gear-label">黄金时段</span>
              <strong className="cs-gear-value">
                {solarEventLabel}前 40m 至{solarEventLabel}后 25m
              </strong>
              <small className="cs-gear-tip">
                以实际云层与地形遮挡重新确认曝光窗口
              </small>
            </div>
            <div className="cs-gear-item">
              <span className="cs-gear-label">拍摄机位朝向</span>
              <strong className="cs-gear-value">
                {targetSun?.compass ?? fallbackCompass} (
                {targetSun?.azimuthDeg ?? fallbackAzimuth}°)
              </strong>
              <small className="cs-gear-tip">
                对准{solarEventLabel}方向提前确认前景与安全站位
              </small>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
