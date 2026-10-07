"use client";
import { useTopicContext, usePublishTopicContext } from "@/hooks/useTopicContext";
import SnapshotSourceDisclosure from "@/components/SnapshotSourceDisclosure";
import type { ReactNode } from "react";
import MapViewportObserver from "@/components/MapViewportObserver";
import MapTileStatus from "@/components/MapTileStatus";
import BlankMapPicker from "@/components/BlankMapPicker";
import MobileDataSheet from "@/components/MobileDataSheet";
import TopicMapSearch from "@/components/TopicMapSearch";
import { useMobilePanelViewport } from "@/components/ResponsiveMapControls";
import { nearbyDirectorySites, type Coordinate } from "@/lib/nearbyDirectorySites";

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
  hasCompleteCloudSeaCoverage,
  hasValidCloudSeaCoverageCounts,
  positionBadgeTone,
  type CloudSeaConditionLevel,
  type CloudSeaSnapshot,
  type CloudSeaWindowScore,
} from "@/lib/cloudsea";
import { buildProbabilityOverlay } from "@/lib/cloudseaOverlay";
import { markerLevelFor } from "@/lib/markerStatus";
import { filterByScoreThreshold } from "@/lib/scoreThreshold";
import ScoreThresholdControl from "@/components/ScoreThresholdControl";
import { formatCompactCalendarDate } from "@/lib/nighttime";
import ResponsiveTopicDetail from "@/components/ResponsiveTopicDetail";
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
  return `${month}月${day}日 周${weekday}`;
}

function rangeOptionLabel(option: (typeof RANGE_OPTIONS)[number], baseDate: string): ReactNode {
  const selectedDate = shiftDate(baseDate, option.value === 3 ? 0 : option.value);
  const compactDate = (date: string) => date.slice(5).split("-").map(Number).join(".");
  const dateText = option.value === 3
    ? `${compactDate(baseDate)}–${compactDate(shiftDate(baseDate, 2))}`
    : compactDate(selectedDate);
  return <><span>{option.label}</span><small title={formatCompactCalendarDate(selectedDate)}>{dateText}</small></>;
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
  const contextBaseDate = todayKey();
  const topicContext = useTopicContext(CLOUD_SEA_SITES, "cloudsea", contextBaseDate);
  const [phase, setPhase] = useState<Phase>(topicContext.incoming.phase ?? "morning");
  const [range, setRange] = useState<RangeMode>(topicContext.initialRange);
  const [snapshots, setSnapshots] = useState<Record<string, CloudSeaSnapshot>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataNotice, setDataNotice] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(topicContext.transfer?.site?.id ?? null);
  const [pickedPoint, setPickedPoint] = useState<Coordinate | null>(topicContext.incoming.identity && !topicContext.transfer?.site ? { latitude: topicContext.incoming.identity.latitude, longitude: topicContext.incoming.identity.longitude } : null);
  const mobile = useMobilePanelViewport();
  const [scoreThreshold, setScoreThreshold] = useState(0);
  const mapRef = useRef<LeafletMap | null>(null);
  const snapshotRequestIdRef = useRef(0);
  const snapshotControllerRef = useRef<AbortController | null>(null);

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
      const requestId = snapshotRequestIdRef.current + 1;
      snapshotRequestIdRef.current = requestId;
      snapshotControllerRef.current?.abort();
      const controller = new AbortController();
      snapshotControllerRef.current = controller;
      setRefreshing(forceRefresh);
      setDataNotice("");
      setLoading(true);
      try {
        const results: SnapshotLoadResult[] = [];
        // Do not fan out all three dates at once: each date already fans out
        // surface plus pressure batches, and the provider may throttle the
        // last date even though today/tomorrow succeeded.
        for (const date of activeDates) {
          if (controller.signal.aborted) return;
          let lastError = "云海快照不可用";
          let degradedSnapshot: CloudSeaSnapshot | null = null;
          for (let attempt = 0; attempt < 2; attempt += 1) {
            if (controller.signal.aborted) return;
            try {
              const url = `/api/cloudsea/snapshot?date=${date}&model=gfs&refresh=${forceRefresh ? "1" : "0"}`;
              const response = await fetch(url, {
                cache: "no-store",
                signal: controller.signal,
              });
              const payload = (await response.json().catch(() => null)) as
                | (CloudSeaSnapshot & { error?: string })
                | null;
              if (response.ok && payload?.sites) {
                if (payload.date !== date || payload.model !== "gfs") {
                  throw new Error("云海快照日期或模型与请求不一致");
                }
                const pressureComplete = hasCompleteCloudSeaCoverage(
                  payload.pressure,
                  CLOUD_SEA_SITES.length,
                );
                const surface = payload.surface;
                const surfaceCountsValid = hasValidCloudSeaCoverageCounts(
                  surface,
                  CLOUD_SEA_SITES.length,
                );
                const surfaceComplete = hasCompleteCloudSeaCoverage(
                  surface,
                  CLOUD_SEA_SITES.length,
                );
                if (pressureComplete && surfaceComplete) {
                  results.push({ date, snapshot: payload });
                  lastError = "";
                  break;
                }
                degradedSnapshot = payload;
                lastError = !surfaceComplete
                  ? !surfaceCountsValid || !surface
                    ? "地面天气覆盖摘要不完整，快照完整性无法验证"
                    : `地面天气仅 ${surface.availableSites}/${surface.totalSites} 地点窗口完整`
                  : !hasValidCloudSeaCoverageCounts(payload.pressure, CLOUD_SEA_SITES.length)
                    ? "压力层覆盖摘要不完整，快照完整性无法验证"
                    : `压力层仅 ${payload.pressure!.availableSites}/${payload.pressure!.totalSites} 地点可用`;
                if (attempt === 1) {
                  results.push({ date, snapshot: payload, error: lastError });
                  lastError = "";
                  break;
                }
              }
              if (!response.ok || !payload?.sites) {
                lastError =
                  payload?.error ??
                  `云海快照请求失败（HTTP ${response.status}）`;
              }
            } catch (error) {
              if (controller.signal.aborted) return;
              lastError =
                error instanceof Error ? error.message : "云海快照请求失败";
            }
            if (attempt === 0) {
              await new Promise((resolve) => setTimeout(resolve, 600));
            }
          }
          if (lastError) {
            results.push(
              degradedSnapshot
                ? { date, snapshot: degradedSnapshot, error: lastError }
                : { date, snapshot: null, error: lastError },
            );
          }
        }

        if (
          controller.signal.aborted ||
          snapshotRequestIdRef.current !== requestId
        ) {
          return;
        }

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
          if (result.error) {
            notices.push(`${dateLabel(result.date)}：${result.error}；已保留部分真实数据`);
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
          const surface = result.snapshot.surface;
          if (surface && surface.status !== "available" && !result.error) {
            notices.push(
              `${dateLabel(result.date)}：地面天气仅 ${surface.availableSites}/${surface.totalSites} 地点窗口完整`,
            );
          }
        }
        setDataNotice([...new Set(notices)].join(" "));
      } catch (error) {
        if (
          controller.signal.aborted ||
          snapshotRequestIdRef.current !== requestId
        ) {
          return;
        }
        const message =
          error instanceof Error ? error.message : "云海快照不可用";
        setDataNotice(message);
        console.error("Failed to load cloudsea snapshot", error);
      } finally {
        if (
          snapshotControllerRef.current === controller &&
          snapshotRequestIdRef.current === requestId
        ) {
          snapshotControllerRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
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
      snapshotRequestIdRef.current += 1;
      snapshotControllerRef.current?.abort();
      snapshotControllerRef.current = null;
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
  const hasActiveSnapshot = activeDates.some((date) => Boolean(snapshots[date]));
  const hasPublishedScore = rankedSites.some(({ window: windowScore }) => windowScore.score != null);
  const selectedContext = useMemo(() => {
    if (!selectedSiteId) return null;
    const winningDate = selectedRanked?.dateKey;
    const datesBySelection = winningDate
      ? [winningDate, ...activeDates.filter((date) => date !== winningDate)]
      : activeDates;
    const rawEntry = datesBySelection
      .map((dateKey) => ({
        dateKey,
        snapshot: snapshots[dateKey],
        window: snapshots[dateKey]?.sites?.[selectedSiteId]?.[phase],
      }))
      .find((entry): entry is { dateKey: string; snapshot: CloudSeaSnapshot; window: CloudSeaWindowScore } => Boolean(entry.window && entry.snapshot));
    if (rawEntry) return rawEntry;
    if (selectedRanked) {
      return {
        dateKey: selectedRanked.dateKey,
        snapshot: snapshots[selectedRanked.dateKey],
        window: selectedRanked.window,
      };
    }
    return null;
  }, [activeDates, phase, selectedRanked, selectedSiteId, snapshots]);
  const selectedWindow = selectedContext?.window ?? null;
  const selectedSnapshot = selectedContext?.snapshot;
  const selectedWindowHasSurfaceEvidence = Boolean(
    selectedWindow && (
      selectedWindow.lowCloud != null ||
      selectedWindow.midCloud != null ||
      selectedWindow.highCloud != null ||
      selectedWindow.humidity != null ||
      selectedWindow.windSpeed != null
    ),
  );
  const snapshotStale = activeDates.some((date) => Boolean(
    snapshots[date]?.stale || snapshots[date]?.refreshError,
  ));
  const selectedSnapshotStale = Boolean(selectedSnapshot?.stale || selectedSnapshot?.refreshError);
  const mainConclusionStale = selectedContext ? selectedSnapshotStale : snapshotStale;
  const mobileConclusion =
    loading && !hasActiveSnapshot
      ? "正在读取云海条件数据…"
      : !hasActiveSnapshot
        ? "数据不可用 · 请重试"
        : mainConclusionStale
          ? "旧数据 · 仅供参考"
          : selectedWindow?.score != null
            ? `条件指数 ${selectedWindow.conditionLabel ?? `${selectedWindow.score}/100`}`
            : selectedWindow?.cloudPosition === "unknown" && (
              selectedWindowHasSurfaceEvidence || selectedWindow.pressureStatus !== "available"
            )
              ? "垂直证据不足"
              : hasPublishedScore && !filteredRankedSites.length
                ? `暂无达到 ≥${scoreThreshold} 分的山峰`
                : !hasPublishedScore
                  ? "当前时段暂无可发布的云海条件指数"
                  : pickedPoint
                    ? "查看附近目录山峰"
                    : "点地图查看山峰";
  const mobileRankingEmptyMessage =
    loading && !hasActiveSnapshot
      ? "正在读取所选日期的数据…"
      : !hasActiveSnapshot
        ? "数据不可用 · 请重试"
        : !hasPublishedScore
          ? "当前时段暂无可发布的云海条件指数"
          : `暂无达到 ≥${scoreThreshold} 分的山峰`;
  const nearby = useMemo(
    () => pickedPoint ? nearbyDirectorySites(pickedPoint, CLOUD_SEA_SITES) : [],
    [pickedPoint],
  );

  const handleSelectSite = (siteId: string) => {
    setPickedPoint(null);
    setSelectedSiteId(siteId);
    const target = CLOUD_SEA_SITES.find((site) => site.id === siteId);
    if (target && mapRef.current) {
      mapRef.current.flyTo([target.latitude, target.longitude], 8, {
        duration: 1.2,
      });
    }
  };

  usePublishTopicContext("/cloudsea", CLOUD_SEA_SITES, "cloudsea", selectedSiteId, pickedPoint, selectedContext?.dateKey ?? primaryDate, phase, topicContext.incoming, topicContext.preservedDate);

  return (
    <div className="cloudsea-root app-shell">
      <TopicMapSearch sites={CLOUD_SEA_SITES}
        onSite={(site) => {
          const forecast = rankedSites.find((entry) => entry.site.id === site.id);
          if (forecast) handleSelectSite(site.id);
          else { handleSelectSite(site.id); }
        }}
        onCoordinate={(point) => { setSelectedSiteId(null); setPickedPoint(point); mapRef.current?.flyTo([point.latitude, point.longitude], 8); }} />
      <ProductHeader
        mark={<Mountains size={18} aria-hidden="true" />}
        markClassName="cloudsea-mark"
        eyebrow="云顶"
        title="云海条件地图"
      >
        <div className="cloudsea-controls">
          <div className="segmented" role="group" aria-label="云海时段选择" data-mode="phase">
            <button
              type="button"
              aria-pressed={phase === "morning"}
              className={phase === "morning" ? "active" : ""}
              onClick={() => setPhase("morning")}
              title="日出与清晨时段（05:00-08:00）"
            >
              <Sunrise size={15} />
              <span>晨间云海</span>
            </button>
            <button
              type="button"
              aria-pressed={phase === "evening"}
              className={phase === "evening" ? "active" : ""}
              onClick={() => setPhase("evening")}
              title="日落与黄昏时段（17:00-19:00）"
            >
              <Sunset size={15} />
              <span>傍晚云海</span>
            </button>
          </div>

          <div className="segmented" role="group" aria-label="预报日期选择" data-mode="range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={range === option.value}
                className={range === option.value ? "active" : ""}
                onClick={() => { topicContext.acceptDate(); setRange(option.value); }}
                title={option.hint}
              >
                {rangeOptionLabel(option, baseDate)}
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
      {topicContext.transfer?.status === "conflict" && !selectedSiteId && pickedPoint?.latitude === topicContext.incoming.identity?.latitude && pickedPoint?.longitude === topicContext.incoming.identity?.longitude ? <p role="status" className="location-transfer-notice" data-testid="location-transfer-conflict">所选地点与本入口目录坐标冲突（相距约 {topicContext.transfer.distanceKm?.toFixed(1) ?? "未知"} km），保留原坐标，未自动合并或套用目录评分。</p> : null}
      {topicContext.dateNotice ? <p role="status" className="location-transfer-notice">{topicContext.dateNotice}</p> : null}


      <details className="cloudsea-beta-banner forecast-method-note">
        <summary>GFS 模型 · 条件指数，非实测概率</summary>
        <p>
        Beta · 条件指数综合 Open-Meteo GFS surface 天气与压力层数值模式剖面；云底/云顶、山顶相对层位和逆温均为模式推导，不是探空或现场仪器实测，也不是实拍样本校准的事件概率。
        </p>
      </details>
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
            dragging
            touchZoom
            doubleClickZoom
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
                    className: "topic-site-marker",
                    color: isSelected ? "#ffffff" : color,
                    weight: isSelected ? 3 : 1.5,
                    fillColor: color,
                    fillOpacity: isUnknown ? 0.38 : 0.88,
                    bubblingMouseEvents: false,
                    dashArray: isUnknown ? "3 3" : undefined,
                  }}
                  eventHandlers={{
                    click: () => { setPickedPoint(null); setSelectedSiteId(site.id); },
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
            <BlankMapPicker point={pickedPoint} onPick={(point) => { setSelectedSiteId(null); setPickedPoint(point); }} />
            <MapViewportObserver />
            <MapTileStatus />
          </MapContainer>

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
          {dataNotice ? (
            <div
              className="cloudsea-beta-banner cloudsea-evidence-status"
              data-testid="cloudsea-evidence-status"
              role="status"
            >
              数据状态 · {dataNotice}
            </div>
          ) : null}

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
            ) : !hasPublishedScore ? (
              <div className="cloudsea-empty-no-score">
                当前时段暂无可发布的云海条件指数
              </div>
            ) : filteredRankedSites.length === 0 ? (
              <div className="cloudsea-empty-threshold">
                暂无达到 ≥{scoreThreshold} 分的山峰
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
                  <button
                    type="button"
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

                    {windowScore.pressureStatus === "partial" ? (
                      <span className="cloudsea-card-evidence">
                        压力时次部分可用
                      </span>
                    ) : windowScore.pressureStatus === "unavailable" && windowScore.cloudPosition === "unknown" ? (
                      <span className="cloudsea-card-evidence">
                        垂直证据不足
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
          <details className="cloudsea-reference-details" data-testid="cloudsea-reference-details">
            <summary>指数口径与色阶</summary>
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
              <p className="cloudsea-reference-note">
                条件指数综合真实 surface 天气与 pressure-level 模式证据；云底、云顶和山顶关系不是探空或现场仪器实测，也不是实拍概率。缺失 pressure 不推断垂直层位。
              </p>
            </div>
          </details>
        </aside>

        <MobileDataSheet
          title={selectedRanked?.site.name ?? (pickedPoint ? `所点坐标 ${pickedPoint.latitude.toFixed(3)}, ${pickedPoint.longitude.toFixed(3)}` : "云海 · 选择山峰")}
          conclusion={mobileConclusion}
          bestTime={selectedWindow?.peakTime ? `最佳 ${selectedWindow.peakTime} · ${dateLabel(selectedContext?.dateKey ?? primaryDate)}` : `${phase === "morning" ? "晨间" : "傍晚"} · ${range === 3 ? "三日" : dateLabel(primaryDate)}`}
          status={dataNotice || (loading ? "正在读取云海条件数据…" : "")}
          selectionKey={selectedSiteId ?? (pickedPoint ? `${pickedPoint.latitude.toFixed(4)},${pickedPoint.longitude.toFixed(4)}` : null)}
        >{(level) => <>
          {pickedPoint ? <section className="mobile-nearby-sites" aria-label="附近云海目录山峰">
            <p>所点坐标只用于找附近山峰；下列指数属于目录点位，不代表该坐标的预测。</p>
            {nearby.map(({ site, distanceKm }) => {
              const forecast = rankedSites.find((entry) => entry.site.id === site.id);
              return <button key={site.id} type="button" onClick={() => forecast ? handleSelectSite(site.id) : mapRef.current?.flyTo([site.latitude, site.longitude], 8)}>
                <strong>{site.name}</strong><span>距所点约 {distanceKm.toFixed(0)} km · {forecast?.window.conditionLabel ?? "数据不足"}</span>
              </button>;
            })}
          </section> : null}
          {selectedRanked && selectedWindow ? <div className="mobile-key-metrics">
            <span>山顶与云层 <strong>{selectedWindow.positionLabel}</strong></span>
            <span>最佳时刻 <strong>{selectedWindow.peakTime ?? "—"}</strong></span>
            <span>湿度 <strong>{selectedWindow.humidity != null ? `${selectedWindow.humidity}%` : "—"}</strong></span>
            <span>近地风 <strong>{selectedWindow.windSpeed != null ? `${selectedWindow.windSpeed}m/s` : "—"}</strong></span>
          </div> : null}
          {level === "full" && selectedRanked && selectedWindow ? <CloudSeaSiteDetail site={selectedRanked.site} window={selectedWindow} phase={phase} dateKey={selectedContext?.dateKey ?? selectedRanked.dateKey} onClose={() => setSelectedSiteId(null)} /> : null}
          {level === "full" ? <details className="mobile-sheet-explainer">
            <summary>数据口径与地图色阶</summary>
            <p>条件指数综合 GFS 地面天气与压力层模式剖面；云底、云顶和逆温为模式推导，不是现场实测。地图色面是目录点位指数插值，缺失数据不推断分数。</p>
            <p>{LEVEL_LABELS.map((entry) => entry.range).join(" · ")} · 数据不足</p>
          </details> : null}
          {!pickedPoint ? <div className="mobile-sheet-ranking" aria-label="云海山峰排行">
            <h3>{phase === "morning" ? "晨间" : "傍晚"}云海 · {range === 3 ? `三日最优 ${dateLabel(primaryDate)}—${dateLabel(activeDates[2])}` : dateLabel(primaryDate)}</h3>
            <ScoreThresholdControl value={scoreThreshold} count={filteredRankedSites.length}
              label="云海推荐门槛" testId="cloudsea-score-threshold" onChange={setScoreThreshold} />
            {(level === "full" ? filteredRankedSites : filteredRankedSites.slice(0, 5)).map(({ site, window, dateKey }) => <button key={site.id} type="button" onClick={() => handleSelectSite(site.id)}>
              <span>{site.name}</span><strong>{range === 3 ? `${dateLabel(dateKey)} · ` : ""}{window.conditionLabel ?? "数据不足"}</strong>
            </button>)}
            {!filteredRankedSites.length ? <p>{mobileRankingEmptyMessage}</p> : null}
          </div> : null}
        </>}</MobileDataSheet>

        {selectedRanked && !mobile ? (
          <ResponsiveTopicDetail
            label={`${selectedRanked.site.name}云海摄影详情`}
            className="cloudsea-detail-layer"
            onClose={() => setSelectedSiteId(null)}
          >
            <CloudSeaSiteDetail
              site={selectedRanked.site}
              window={selectedWindow ?? selectedRanked.window}
              phase={phase}
              dateKey={selectedContext?.dateKey ?? selectedRanked.dateKey}
              onClose={() => setSelectedSiteId(null)}
            />
          </ResponsiveTopicDetail>
        ) : null}
      </div>
      <SnapshotSourceDisclosure snapshot={selectedContext?.snapshot ?? snapshots[primaryDate]} siteId={selectedSiteId} />
    </div>
  );
}
