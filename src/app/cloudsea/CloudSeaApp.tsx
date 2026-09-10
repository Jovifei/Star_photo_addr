"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sunrise,
  Sunset,
  Mountain as Mountains,
  RefreshCw,
} from "lucide-react";
import {
  CircleMarker,
  ImageOverlay,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";
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
  type CloudSeaConditionLevel,
  type CloudSeaSnapshot,
  type CloudSeaWindowScore,
} from "@/lib/cloudsea";
import { buildProbabilityOverlay } from "@/lib/cloudseaOverlay";
import { markerLevelFor } from "@/lib/markerStatus";
import { filterByScoreThreshold } from "@/lib/scoreThreshold";
import ScoreThresholdControl from "@/components/ScoreThresholdControl";
import CloudSeaSiteDetail from "./CloudSeaSiteDetail";
import "./cloudsea.css";

type Phase = "morning" | "evening";
type RangeMode = 0 | 1 | 2 | 3;

const LEVEL_COLORS: Record<CloudSeaConditionLevel, string> = {
  p20: "#5f7078",
  p40: "#48b5b5",
  p60: "#3498db",
  p80: "#1f78d1",
  p90: "#1956b3",
  p100: "#4b2ca5",
};
const UNKNOWN_MARKER_COLOR = "#6f7880";

const LEVEL_LABELS: Array<{ level: CloudSeaConditionLevel; range: string }> = [
  { level: "p20", range: "0–20" },
  { level: "p40", range: "20–40" },
  { level: "p60", range: "40–60" },
  { level: "p80", range: "60–80" },
  { level: "p90", range: "80–90" },
  { level: "p100", range: "90–100" },
];

function todayKey(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
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
  {
    value: 3,
    label: "三日总览",
    hint: "今日 + 明日 + 后日 的对比，取三日最佳",
  },
];

interface RankedSite {
  site: CloudSeaSite;
  window: CloudSeaWindowScore;
  dateKey: string;
}

interface SnapshotLoadResult {
  date: string;
  snapshot: CloudSeaSnapshot | null;
  error?: string;
}

export default function CloudSeaApp() {
  const [phase, setPhase] = useState<Phase>("morning");
  const [range, setRange] = useState<RangeMode>(0);
  const [snapshots, setSnapshots] = useState<Record<string, CloudSeaSnapshot>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataNotice, setDataNotice] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [scoreThreshold, setScoreThreshold] = useState(0);
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
      setLoading(true);
      try {
        const results = await Promise.all(
          activeDates.map(async (date): Promise<SnapshotLoadResult> => {
            let lastError = "云海快照不可用";
            for (let attempt = 0; attempt < 2; attempt += 1) {
              try {
                const url = `/api/cloudsea/snapshot?date=${date}&refresh=${forceRefresh ? "1" : "0"}`;
                const response = await fetch(url, { cache: "no-store" });
                const payload = (await response.json().catch(() => null)) as
                  | (CloudSeaSnapshot & { error?: string })
                  | null;
                if (response.ok && payload?.sites) {
                  return { date, snapshot: payload };
                }
                lastError =
                  payload?.error ??
                  `云海快照请求失败（HTTP ${response.status}）`;
              } catch (error) {
                lastError =
                  error instanceof Error ? error.message : "云海快照请求失败";
              }
            }
            return { date, snapshot: null, error: lastError };
          }),
        );

        const validEntries = results.filter(
          (
            result,
          ): result is SnapshotLoadResult & { snapshot: CloudSeaSnapshot } =>
            result.snapshot !== null,
        );
        const valid = Object.fromEntries(
          validEntries.map(({ date, snapshot }) => [date, snapshot]),
        ) as Record<string, CloudSeaSnapshot>;
        setSnapshots((previous) => ({ ...previous, ...valid }));

        const notices: string[] = [];
        for (const result of results) {
          if (!result.snapshot) {
            notices.push(
              `${dateLabel(result.date)}：${result.error ?? "真实气象数据不可用"}`,
            );
            continue;
          }
          if (result.snapshot.stale || result.snapshot.refreshError) {
            notices.push(
              `${dateLabel(result.date)}：${result.snapshot.refreshError ?? "正在使用较早的成功快照"}`,
            );
          }
          const pressure = result.snapshot.pressure;
          if (pressure && pressure.status !== "available") {
            notices.push(
              `${dateLabel(result.date)}：压力层 ${pressure.availableSites}/${pressure.totalSites} 地点可用；缺失地点不推断云层层位`,
            );
          }
        }
        setDataNotice([...new Set(notices)].join(" "));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "云海快照不可用";
        setDataNotice(message);
        console.error("Failed to load cloudsea snapshot", error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeDates],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void fetchSnapshots();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchSnapshots]);

  const rankedSites = useMemo<RankedSite[]>(() => {
    const hasData = activeDates.some((date) => Boolean(snapshots[date]));
    if (!hasData) return [];

    const list: RankedSite[] = [];
    for (const site of CLOUD_SEA_SITES) {
      let bestWindow: CloudSeaWindowScore = CLOUD_SEA_EMPTY_WINDOW;
      let bestDate = primaryDate;

      for (const date of activeDates) {
        const snapshot = snapshots[date];
        const siteData = snapshot?.sites?.[site.id];
        const window = siteData
          ? siteData[phase]
          : CLOUD_SEA_EMPTY_WINDOW;
        if ((window.score ?? -1) > (bestWindow.score ?? -1)) {
          bestWindow = window;
          bestDate = date;
        }
      }

      list.push({ site, window: bestWindow, dateKey: bestDate });
    }

    list.sort(
      (left, right) =>
        (right.window.score ?? -1) - (left.window.score ?? -1),
    );
    return list;
  }, [activeDates, snapshots, phase, primaryDate]);

  const filteredRankedSites = useMemo(
    () => filterByScoreThreshold(rankedSites, scoreThreshold, (ranked) => ranked.window.score),
    [rankedSites, scoreThreshold],
  );

  const overlayPoints = useMemo(
    () =>
      rankedSites.map((ranked) => ({
        latitude: ranked.site.latitude,
        longitude: ranked.site.longitude,
        score: ranked.window.score,
      })),
    [rankedSites],
  );

  const conditionOverlay = useMemo(() => {
    if (typeof window === "undefined") return null;
    return buildProbabilityOverlay(overlayPoints);
  }, [overlayPoints]);

  const selectedRanked = useMemo(() => {
    if (!selectedSiteId) return null;
    return (
      rankedSites.find((ranked) => ranked.site.id === selectedSiteId) ?? null
    );
  }, [rankedSites, selectedSiteId]);

  const handleSelectSite = (siteId: string) => {
    setSelectedSiteId(siteId);
    const target = CLOUD_SEA_SITES.find((site) => site.id === siteId);
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
        title="云海条件地图"
      >
        <div className="cloudsea-controls">
          <div className="segmented" role="group" aria-label="云海时段选择">
            <button
              type="button"
              className={phase === "morning" ? "active" : ""}
              onClick={() => setPhase("morning")}
              title="日出与清晨时段（05:00-08:00）"
            >
              <Sunrise size={15} />
              <span>晨间云海</span>
            </button>
            <button
              type="button"
              className={phase === "evening" ? "active" : ""}
              onClick={() => setPhase("evening")}
              title="日落与黄昏时段（17:00-19:00）"
            >
              <Sunset size={15} />
              <span>傍晚云海</span>
            </button>
          </div>

          <div className="segmented" role="group" aria-label="预报日期选择">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={range === option.value ? "active" : ""}
                onClick={() => setRange(option.value)}
                title={option.hint}
              >
                <span>{option.label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="cloudsea-refresh"
            onClick={() => void fetchSnapshots(true)}
            disabled={refreshing}
            title="强制更新最新云海条件数据"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "is-spinning" : ""}
            />
            <span>{refreshing ? "正在计算..." : "更新数据"}</span>
          </button>
        </div>
      </ProductHeader>

      <div className="cloudsea-beta-banner" role="note">
        Beta · 条件指数综合 Open-Meteo surface 天气与压力层数值模式剖面；云底/云顶、山顶相对层位和逆温均为模式推导，不是探空或现场仪器实测，也不是实拍样本校准的事件概率。
      </div>
      {dataNotice ? (
        <div className="cloudsea-beta-banner" role="status">
          数据状态 · {dataNotice}
        </div>
      ) : null}

      <div
        className="cloudsea-body"
        data-inspector-open={selectedRanked ? "true" : "false"}
      >
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

            {conditionOverlay && (
              <ImageOverlay
                url={conditionOverlay.url}
                bounds={conditionOverlay.bounds}
                opacity={0.7}
                alt="云海条件指数点位插值色面"
              />
            )}

            {rankedSites.map(({ site, window: windowScore }) => {
              const level = markerLevelFor(
                windowScore.score,
                windowScore.conditionLevel,
              );
              const isUnknown = level === "unknown";
              const color = isUnknown ? UNKNOWN_MARKER_COLOR : LEVEL_COLORS[level];
              const isSelected = site.id === selectedSiteId;

              return (
                <CircleMarker
                  key={site.id}
                  center={[site.latitude, site.longitude]}
                  radius={isSelected ? 10 : isUnknown ? 6 : 7}
                  pathOptions={{
                    color: isSelected ? "#ffffff" : color,
                    weight: isSelected ? 3 : 1.5,
                    fillColor: color,
                    fillOpacity: isUnknown ? 0.38 : 0.88,
                    dashArray: isUnknown ? "3 3" : undefined,
                  }}
                  eventHandlers={{
                    click: () => setSelectedSiteId(site.id),
                  }}
                >
                  <Popup className="cloudsea-popup">
                    <div style={{ color: "#041018", minWidth: "180px" }}>
                      <h3
                        style={{ margin: "0 0 4px", fontSize: "14px" }}
                      >
                        {site.name}（{site.altitude}m）
                      </h3>
                      <p
                        style={{
                          margin: "0 0 6px",
                          fontSize: "12px",
                          color: "#555",
                        }}
                      >
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
                        <span>
                          云海条件指数: {windowScore.conditionLabel ?? "—"}
                        </span>
                        <span
                          style={{
                            color:
                              windowScore.cloudPosition === "above"
                                ? "#27ae60"
                                : "#d35400",
                          }}
                        >
                          {windowScore.positionLabel}
                        </span>
                      </div>
                      {windowScore.score == null ? (
                        <div className="cloudsea-popup-unavailable">数据不足</div>
                      ) : null}
                      <div style={{ fontSize: "11px", color: "#666" }}>
                        模式云顶: {windowScore.cloudTopM != null ? `${windowScore.cloudTopM}m` : "—"} · 模式云底:{" "}
                        {windowScore.cloudBaseM != null
                          ? `${windowScore.cloudBaseM}m`
                          : "—"}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          <div className="cloudsea-legend">
            <span className="cloudsea-legend-title">
              云海条件指数色阶 · 点位插值
            </span>
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
              <span
                className="cloudsea-legend-chip cloudsea-legend-unknown"
                style={{ backgroundColor: UNKNOWN_MARKER_COLOR }}
              >
                数据不足
              </span>
            </div>
          </div>
        </div>

        <aside className="cloudsea-sidebar">
          <div className="cloudsea-sidebar-header">
            <h2>
              {phase === "morning"
                ? "晨间云海推荐榜"
                : "傍晚云海推荐榜"}
            </h2>
            <span>
              {range === 3 ? "三日最优" : dateLabel(primaryDate)} ·{" "}
              ≥{scoreThreshold}分 {filteredRankedSites.length} 处名山
            </span>
          </div>
          <ScoreThresholdControl
            value={scoreThreshold}
            count={filteredRankedSites.length}
            label="云海推荐门槛"
            testId="cloudsea-score-threshold"
            onChange={setScoreThreshold}
          />

          <div className="cloudsea-site-list">
            {loading && rankedSites.length === 0 ? (
              <div
                style={{
                  padding: "48px 16px",
                  textAlign: "center",
                  color: "var(--cs-muted)",
                }}
              >
                <RefreshCw
                  size={24}
                  className="is-spinning"
                  style={{ margin: "0 auto 12px", display: "block" }}
                />
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "14px",
                    color: "var(--cs-text)",
                    fontWeight: 600,
                  }}
                >
                  正在分析 surface 水汽、低云与压力层垂直剖面...
                </p>
                <span style={{ fontSize: "12px", opacity: 0.8 }}>
                  基于真实 Open-Meteo surface weather 与 pressure-level 模式数据计算条件指数
                </span>
              </div>
            ) : !loading && rankedSites.length === 0 ? (
              <div
                style={{
                  padding: "48px 16px",
                  textAlign: "center",
                  color: "var(--cs-muted)",
                }}
              >
                <p style={{ margin: "0 0 12px", fontSize: "13px" }}>
                  真实云海气象数据暂不可用，请点击重试
                </p>
                <button
                  type="button"
                  className="cloudsea-refresh"
                  onClick={() => void fetchSnapshots(true)}
                  style={{ margin: "0 auto" }}
                >
                  <RefreshCw size={14} /> 重新获取数据
                </button>
              </div>
            ) : filteredRankedSites.length === 0 ? (
              <div className="cloudsea-empty-threshold">
                暂无达到 ≥{scoreThreshold} 分的地点
              </div>
            ) : (
              filteredRankedSites.map(({ site, window: windowScore }) => {
                const isSelected = site.id === selectedSiteId;
                const level = markerLevelFor(
                  windowScore.score,
                  windowScore.conditionLevel,
                );
                const isUnknown = level === "unknown";
                const scoreColor = isUnknown
                  ? UNKNOWN_MARKER_COLOR
                  : LEVEL_COLORS[level];
                const badgeTone = positionBadgeTone(
                  windowScore.cloudPosition,
                );

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
                          {site.province} · 海拔 {site.altitude}m ·{" "}
                          {site.viewpoint}
                        </span>
                      </div>
                      <div className="cloudsea-card-score">
                        <span
                          className="cloudsea-score-badge"
                          data-level={level}
                          style={{ color: scoreColor }}
                          title={isUnknown ? "数据不足" : undefined}
                        >
                          {windowScore.conditionLabel ?? "—"}
                        </span>
                        {isUnknown ? (
                          <small className="cloudsea-score-state">数据不足</small>
                        ) : null}
                        <span
                          className={`cloudsea-pos-badge ${badgeTone}`}
                        >
                          {windowScore.positionLabel}
                        </span>
                      </div>
                    </div>

                    <div className="cloudsea-profile-strip">
                      <div>
                        <label>模式云顶</label>
                        <strong>
                          {windowScore.cloudTopM != null
                            ? `${windowScore.cloudTopM}m`
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <label>峰顶-云顶高差</label>
                        <strong>
                          {windowScore.altitudeDiffM != null
                            ? `${windowScore.altitudeDiffM > 0 ? "+" : ""}${windowScore.altitudeDiffM}m`
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <label>近地风速</label>
                        <strong>
                          {windowScore.windSpeed != null
                            ? `${windowScore.windSpeed}m/s`
                            : "—"}
                        </strong>
                      </div>
                    </div>

                    <p className="cloudsea-card-summary">
                      {windowScore.summary}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {selectedRanked ? (
          <CloudSeaSiteDetail
            site={selectedRanked.site}
            window={selectedRanked.window}
            phase={phase}
            dateKey={selectedRanked.dateKey}
            onClose={() => setSelectedSiteId(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
