"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sunrise, Sunset, Mountain as Mountains, RefreshCw } from "lucide-react";
import { CircleMarker, ImageOverlay, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import ChineseLabelLayer from "@/components/ChineseLabelLayer";
import BoundaryLayers from "@/components/BoundaryLayers";
import ProductHeader from "@/components/ProductHeader";
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_SUBDOMAINS,
  BASEMAP_TILE_CLASS_NAME,
  BASEMAP_TILE_URL,
} from "@/lib/constants";
import { CLOUD_SEA_SITES, type CloudSeaSite } from "@/lib/cloudseaSites";
import {
  CLOUD_SEA_EMPTY_WINDOW,
  positionBadgeTone,
  type CloudSeaProbabilityLevel,
  type CloudSeaSnapshot,
  type CloudSeaWindowScore,
} from "@/lib/cloudsea";
import { buildProbabilityOverlay } from "@/lib/cloudseaOverlay";
import "./cloudsea.css";

type Phase = "morning" | "evening";
/** today-0 / +1 / +2 / 三日总览-3 */
type RangeMode = 0 | 1 | 2 | 3;

const LEVEL_COLORS: Record<CloudSeaProbabilityLevel, string> = {
  p20: "#5f7078",
  p40: "#48b5b5",
  p60: "#3498db",
  p80: "#1f78d1",
  p90: "#1956b3",
  p100: "#4b2ca5",
};

const LEVEL_LABELS: Array<{ level: CloudSeaProbabilityLevel; range: string }> = [
  { level: "p20", range: "0–20%" },
  { level: "p40", range: "20–40%" },
  { level: "p60", range: "40–60%" },
  { level: "p80", range: "60–80%" },
  { level: "p90", range: "80–90%" },
  { level: "p100", range: "90–100%" },
];

function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][
    new Date(`${date}T12:00:00Z`).getUTCDay()
  ];
  return `${month}/${day} 周${weekday}`;
}

const RANGE_OPTIONS: Array<{ value: RangeMode; label: string; hint: string }> = [
  { value: 0, label: "今日", hint: "今晨 / 今晚云海" },
  { value: 1, label: "明日", hint: "明天云海窗口" },
  { value: 2, label: "后日", hint: "后天云海窗口" },
  { value: 3, label: "三日总览", hint: "今日 + 明日 + 后日 的对比，取三日最佳" },
];

interface RankedSite {
  site: CloudSeaSite;
  window: CloudSeaWindowScore;
  dateKey: string;
}

export default function CloudSeaApp() {
  const [phase, setPhase] = useState<Phase>("morning");
  const [range, setRange] = useState<RangeMode>(0);
  const [snapshots, setSnapshots] = useState<Record<string, CloudSeaSnapshot>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const baseDate = useMemo(() => todayKey(), []);
  const activeDates = useMemo<string[]>(() => {
    if (range === 3) {
      return [baseDate, shiftDate(baseDate, 1), shiftDate(baseDate, 2)];
    }
    return [shiftDate(baseDate, range)];
  }, [baseDate, range]);

  const primaryDate = activeDates[0];

  const fetchSnapshots = useCallback(
    async (forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      try {
        const results: Record<string, CloudSeaSnapshot> = {};
        for (const d of activeDates) {
          const url = `/api/cloudsea/snapshot?date=${d}&refresh=${forceRefresh ? "1" : "0"}`;
          const res = await fetch(url);
          if (res.ok) {
            results[d] = await res.json();
          }
        }
        setSnapshots((prev) => ({ ...prev, ...results }));
      } catch (err) {
        console.error("Failed to load cloudsea snapshot", err);
      } finally {
        setRefreshing(false);
      }
    },
    [activeDates],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void fetchSnapshots();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fetchSnapshots]);

  // Rank sites
  const rankedSites = useMemo<RankedSite[]>(() => {
    const list: RankedSite[] = [];
    for (const site of CLOUD_SEA_SITES) {
      let bestWin: CloudSeaWindowScore = CLOUD_SEA_EMPTY_WINDOW;
      let bestDate = primaryDate;

      for (const d of activeDates) {
        const snap = snapshots[d];
        const siteData = snap?.sites?.[site.id];
        const win = siteData ? siteData[phase] : CLOUD_SEA_EMPTY_WINDOW;

        if ((win.score ?? -1) > (bestWin.score ?? -1)) {
          bestWin = win;
          bestDate = d;
        }
      }

      list.push({ site, window: bestWin, dateKey: bestDate });
    }

    list.sort((a, b) => (b.window.score ?? -1) - (a.window.score ?? -1));
    return list;
  }, [activeDates, snapshots, phase, primaryDate]);

  // Interpolated overlay points
  const overlayPoints = useMemo(() => {
    return rankedSites.map((r) => ({
      latitude: r.site.latitude,
      longitude: r.site.longitude,
      score: r.window.score,
    }));
  }, [rankedSites]);

  const probabilityOverlay = useMemo(() => {
    if (typeof window === "undefined") return null;
    return buildProbabilityOverlay(overlayPoints);
  }, [overlayPoints]);

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    const target = CLOUD_SEA_SITES.find((s) => s.id === siteId);
    if (target && mapRef.current) {
      mapRef.current.flyTo([target.latitude, target.longitude], 8, {
        duration: 1.2,
      });
    }
  };

  return (
    <div className="cloudsea-root app-shell">
      <ProductHeader
        mark={<Mountains size={18} aria-hidden="true" />}
        markClassName="cloudsea-mark"
        eyebrow="云顶"
        title="云海预测地图"
      >
        <div className="cloudsea-controls">
          {/* 晨间 / 傍晚 窗口切换 */}
          <div className="segmented" role="group" aria-label="云海时段选择">
            <button
              type="button"
              className={phase === "morning" ? "active" : ""}
              onClick={() => setPhase("morning")}
              title="日出与清晨时段（05:00-09:00）"
            >
              <Sunrise size={15} />
              <span>晨间云海</span>
            </button>
            <button
              type="button"
              className={phase === "evening" ? "active" : ""}
              onClick={() => setPhase("evening")}
              title="日落与黄昏时段（17:00-19:30）"
            >
              <Sunset size={15} />
              <span>傍晚云海</span>
            </button>
          </div>

          {/* 日期范围切换 */}
          <div className="segmented" role="group" aria-label="预报日期选择">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={range === opt.value ? "active" : ""}
                onClick={() => setRange(opt.value)}
                title={opt.hint}
              >
                <span>{opt.label}</span>
              </button>
            ))}
          </div>

          {/* 刷新按钮 */}
          <button
            type="button"
            className="cloudsea-refresh"
            onClick={() => void fetchSnapshots(true)}
            disabled={refreshing}
            title="强制更新最新气象云海数据"
          >
            <RefreshCw size={14} className={refreshing ? "is-spinning" : ""} />
            <span>{refreshing ? "正在计算..." : "更新数据"}</span>
          </button>
        </div>
      </ProductHeader>

      <div className="cloudsea-body">
        {/* 左侧 Leaflet 全屏地图 */}
        <div className="cloudsea-map-pane">
          <MapContainer
            center={[32.0, 108.0]}
            zoom={5}
            minZoom={3}
            maxZoom={12}
            scrollWheelZoom={true}
            ref={mapRef}
          >
            <TileLayer
              attribution={BASEMAP_ATTRIBUTION}
              url={BASEMAP_TILE_URL}
              subdomains={BASEMAP_SUBDOMAINS}
              className={BASEMAP_TILE_CLASS_NAME}
            />
            <BoundaryLayers />
            <ChineseLabelLayer />

            {/* 蓝青色概率热力图层 */}
            {probabilityOverlay && (
              <ImageOverlay
                url={probabilityOverlay.url}
                bounds={probabilityOverlay.bounds}
                opacity={0.7}
              />
            )}

            {/* 各山峰点位圆点标记 */}
            {rankedSites.map(({ site, window: win }) => {
              const pLevel = win.probabilityLevel ?? "p20";
              const color = LEVEL_COLORS[pLevel];
              const isSelected = site.id === selectedSiteId;

              return (
                <CircleMarker
                  key={site.id}
                  center={[site.latitude, site.longitude]}
                  radius={isSelected ? 10 : 7}
                  pathOptions={{
                    color: isSelected ? "#ffffff" : color,
                    weight: isSelected ? 3 : 1.5,
                    fillColor: color,
                    fillOpacity: 0.88,
                  }}
                  eventHandlers={{
                    click: () => setSelectedSiteId(site.id),
                  }}
                >
                  <Popup className="cloudsea-popup">
                    <div style={{ color: "#041018", minWidth: "180px" }}>
                      <h3 style={{ margin: "0 0 4px", fontSize: "14px" }}>
                        {site.name}（{site.altitude}m）
                      </h3>
                      <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#555" }}>
                        {site.province} · {site.viewpoint}
                      </p>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: "bold",
                          marginBottom: "4px",
                        }}
                      >
                        <span>云海概率: {win.probabilityLabel ?? "—"}</span>
                        <span style={{ color: win.cloudPosition === "above" ? "#27ae60" : "#d35400" }}>
                          {win.positionLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        云顶: {win.cloudTopM ? `${win.cloudTopM}m` : "—"} · 云底:{" "}
                        {win.cloudBaseM ? `${win.cloudBaseM}m` : "—"}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* 地图左下角图例 */}
          <div className="cloudsea-legend">
            <span className="cloudsea-legend-title">云海出现概率色阶</span>
            <div className="cloudsea-legend-bar">
              {LEVEL_LABELS.map((item) => (
                <span
                  key={item.level}
                  className="cloudsea-legend-chip"
                  style={{ backgroundColor: LEVEL_COLORS[item.level] }}
                >
                  {item.range}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧山峰点位排行面板 */}
        <aside className="cloudsea-sidebar">
          <div className="cloudsea-sidebar-header">
            <h2>
              {phase === "morning" ? "晨间云海推荐榜" : "傍晚云海推荐榜"}
            </h2>
            <span>
              {range === 3 ? "三日最优" : dateLabel(primaryDate)} · {rankedSites.length} 处名山
            </span>
          </div>

          <div className="cloudsea-site-list">
            {rankedSites.map(({ site, window: win }) => {
              const isSelected = site.id === selectedSiteId;
              const pLevel = win.probabilityLevel ?? "p20";
              const scoreColor = LEVEL_COLORS[pLevel];
              const badgeTone = positionBadgeTone(win.cloudPosition);

              return (
                <div
                  key={site.id}
                  className={`cloudsea-card${isSelected ? " selected" : ""}`}
                  onClick={() => handleSelectSite(site.id)}
                >
                  <div className="cloudsea-card-header">
                    <div className="cloudsea-card-title">
                      <span className="cloudsea-card-name">{site.name}</span>
                      <span className="cloudsea-card-sub">
                        {site.province} · 海拔 {site.altitude}m · {site.viewpoint}
                      </span>
                    </div>
                    <div className="cloudsea-card-score">
                      <span
                        className="cloudsea-score-badge"
                        style={{ color: scoreColor }}
                      >
                        {win.probabilityLabel ?? "—"}
                      </span>
                      <span className={`cloudsea-pos-badge ${badgeTone}`}>
                        {win.positionLabel}
                      </span>
                    </div>
                  </div>

                  {/* 剖面高度条 */}
                  <div className="cloudsea-profile-strip">
                    <div>
                      <label>预估云顶</label>
                      <strong>{win.cloudTopM ? `${win.cloudTopM}m` : "—"}</strong>
                    </div>
                    <div>
                      <label>相对高差</label>
                      <strong>
                        {win.altitudeDiffM != null
                          ? `${win.altitudeDiffM > 0 ? "+" : ""}${win.altitudeDiffM}m`
                          : "—"}
                      </strong>
                    </div>
                    <div>
                      <label>近地风速</label>
                      <strong>{win.windSpeed != null ? `${win.windSpeed}m/s` : "—"}</strong>
                    </div>
                  </div>

                  <p className="cloudsea-card-summary">{win.summary}</p>
                </div>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
