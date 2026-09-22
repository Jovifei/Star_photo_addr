"use client";
import MapScrollControl from "@/components/MapScrollControl";
import MapTileStatus from "@/components/MapTileStatus";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sunrise, Sunset, Flame, RefreshCw } from "lucide-react";
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
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { FireGlowProbabilityLevel, FireGlowSnapshot, FireGlowWindowScore } from "@/lib/fireglow";
import { fireGlowBandLabel } from "@/lib/fireglow";
import { buildProbabilityOverlay } from "@/lib/fireglowOverlay";
import { markerLevelFor } from "@/lib/markerStatus";
import { filterByScoreThreshold } from "@/lib/scoreThreshold";
import { formatCalendarDate, formatCompactCalendarDate, formatRelativeDateLabel } from "@/lib/nighttime";
import ScoreThresholdControl from "@/components/ScoreThresholdControl";
import ResponsiveTopicDetail from "@/components/ResponsiveTopicDetail";
import FireglowSiteDetail from "./FireglowSiteDetail";

type Phase = "evening" | "morning";
/** today-0 / +1 / +2 / 三日总览 */
type RangeMode = 0 | 1 | 2 | 3;

const LEVEL_COLORS: Record<FireGlowProbabilityLevel, string> = {
  p20: "#5f7078",
  p40: "#5da46b",
  p60: "#d4b273",
  p80: "#e08a3f",
  p88: "#e07a2f",
  p95: "#c45c1e",
  p100: "#a84814",
};
const UNKNOWN_MARKER_COLOR = "#6f7880";
const LEVEL_LABELS: Array<{ level: FireGlowProbabilityLevel; range: string }> = [
  { level: "p20", range: "0–20" },
  { level: "p40", range: "20–40" },
  { level: "p60", range: "40–60" },
  { level: "p80", range: "60–80" },
  { level: "p88", range: "80–88" },
  { level: "p95", range: "88–95" },
  { level: "p100", range: "95–100" },
];

const UNKNOWN_WINDOW: FireGlowWindowScore = {
  score: null,
  band: "unknown",
  bandLabel: fireGlowBandLabel("unknown"),
  probabilityLabel: null,
  probabilityLevel: null,
  vividness: null,
  momentLabel: null,
  peakTime: null,
  deckCloud: null,
  lowCloud: null,
  midCloud: null,
  highCloud: null,
  visibilityKm: null,
  sunAltitude: null,
  goldenTime: null,
  blueTime: null,
  astroTime: null,
  reason: "暂无数据",
};

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
  return formatCalendarDate(date);
}

function rangeOptionLabel(
  option: (typeof RANGE_OPTIONS)[number],
  baseDate: string,
): string {
  if (option.value === 3) {
    return `${option.label} · ${formatCompactCalendarDate(baseDate)}—${formatCompactCalendarDate(shiftDate(baseDate, 2))}`;
  }
  return formatRelativeDateLabel(shiftDate(baseDate, option.value), baseDate);
}

function hasUsableFireGlowScores(snapshot: FireGlowSnapshot): boolean {
  return Object.values(snapshot.sites ?? {}).some(
    (site) => site.evening?.score != null || site.morning?.score != null,
  );
}

const RANGE_OPTIONS: Array<{ value: RangeMode; label: string; hint: string }> = [
  { value: 0, label: "今日", hint: "今晚 / 今晨窗口" },
  { value: 1, label: "明日", hint: "明天窗口" },
  { value: 2, label: "后日", hint: "后天窗口" },
  { value: 3, label: "三日总览", hint: "今日 + 明日 + 后日 的逐日对比，排名取三日最佳" },
];

interface RankedSite {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  window: FireGlowWindowScore;
  days?: Array<{
    date: string;
    score: number | null;
    level: FireGlowProbabilityLevel | "unknown" | null;
  }>;
}

export default function FireglowApp() {
  const [rangeMode, setRangeMode] = useState<RangeMode>(0);
  const [phase, setPhase] = useState<Phase>("evening");
  const [snapshots, setSnapshots] = useState<Record<string, FireGlowSnapshot | null>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scoreThreshold, setScoreThreshold] = useState(0);
  const loadTokenRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const baseDate = todayKey();
  const activeDates = useMemo(
    () => (rangeMode === 3 ? [0, 1, 2].map((offset) => shiftDate(baseDate, offset)) : [shiftDate(baseDate, rangeMode)]),
    [baseDate, rangeMode],
  );

  const load = useCallback(
    (dates: string[], { force = false }: { force?: boolean } = {}) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      queueMicrotask(() => {
        if (controller.signal.aborted || loadTokenRef.current !== token) return;
        setRequestKey(dates.join("|"));
        setStatus("loading");
        setError("");
        Promise.allSettled(
          dates.map((date) =>
            fetch(
              `/api/fireglow/snapshot?date=${date}${force ? "&refresh=1" : ""}`,
              { signal: controller.signal, cache: "no-store" },
            ).then(async (response) => {
              const payload = await response.json().catch(() => null);
              if (!response.ok || !payload?.sites) {
                throw new Error(payload?.error ?? "火烧云快照不可用");
              }
              if (!hasUsableFireGlowScores(payload)) {
                throw new Error("上游未返回有效火烧云评分，请点击刷新重试");
              }
              if (payload.date !== date) throw new Error("快照日期与请求不一致，请重试");
              return payload as FireGlowSnapshot;
            }),
          ),
        )
          .then((results) => {
            if (controller.signal.aborted || loadTokenRef.current !== token) return;
            setSnapshots((current) => {
              const next = { ...current };
              results.forEach((result, index) => {
                const date = dates[index];
                if (result.status === "fulfilled") next[date] = result.value;
                else if (next[date]) next[date] = {
                  ...next[date]!, stale: true,
                  refreshError: result.reason instanceof Error ? result.reason.message : "刷新失败",
                };
              });
              return next;
            });
            setStatus(results.some((result) => result.status === "rejected") ? "error" : "ready");
            setError(results.flatMap((result, index) => {
              const message = result.status === "rejected"
                ? (result.reason instanceof Error ? result.reason.message : "快照请求失败")
                : result.value.refreshError ?? (result.value.stale ? "正在使用较早快照" : "");
              return message ? [`${dateLabel(dates[index])}：${message}`] : [];
            }).join(" "));
          })
          .catch((requestError) => {
            if (requestError?.name === "AbortError" || loadTokenRef.current !== token) return;
            setStatus("error");
            setError(requestError instanceof Error ? requestError.message : "火烧云快照不可用");
          });
      });
      return () => controller.abort();
    },
    [],
  );

  useEffect(() => {
    const cleanup = load(activeDates);
    return cleanup;
  }, [activeDates, load]);

  const ranked = useMemo<RankedSite[]>(() => {
    if (!activeDates.some((date) => snapshots[date])) return [];
    return OBSERVING_SITES.map((site) => {
      const windows = activeDates.map(
        (date) => snapshots[date]?.sites[site.id]?.[phase] ?? UNKNOWN_WINDOW,
      );
      const scored = windows.filter((window) => window.score != null);
      const best = scored.length
        ? scored.reduce((top, window) => ((window.score ?? 0) > (top.score ?? 0) ? window : top))
        : windows[0] ?? UNKNOWN_WINDOW;
      return {
        id: site.id,
        name: site.name,
        province: site.province,
        latitude: site.latitude,
        longitude: site.longitude,
        altitude: site.altitude,
        window: best,
        days: rangeMode === 3
          ? activeDates.map((date, index) => ({
              date,
              score: windows[index].score,
              level: markerLevelFor(
                windows[index].score,
                windows[index].probabilityLevel,
              ),
            }))
          : undefined,
      };
    }).sort((left, right) => (right.window.score ?? -1) - (left.window.score ?? -1));
  }, [activeDates, phase, rangeMode, snapshots]);

  const overlay = useMemo(() => {
    if (!ranked.length) return null;
    return buildProbabilityOverlay(
      ranked.map((site) => ({ latitude: site.latitude, longitude: site.longitude, score: site.window.score })),
    );
  }, [ranked]);

  const filteredRanked = useMemo(
    () => filterByScoreThreshold(ranked, scoreThreshold, (site) => site.window.score),
    [ranked, scoreThreshold],
  );
  const selectedSite = ranked.find((site) => site.id === selectedId) ?? null;
  const selectedDateKey = useMemo(() => {
    if (!selectedSite) return activeDates[0] ?? baseDate;
    return activeDates.find(
      (date) => snapshots[date]?.sites[selectedSite.id]?.[phase] === selectedSite.window,
    ) ?? activeDates[0] ?? baseDate;
  }, [activeDates, baseDate, phase, selectedSite, snapshots]);
  const activeDataDegraded = activeDates.some(
    (date) => Boolean(snapshots[date]?.stale || snapshots[date]?.refreshError),
  );
  const dataQualityNotice = activeDataDegraded
    ? "数据已降级：地图、排行与详情仅供参考，禁止作为新鲜推荐"
    : "";

  const focusSite = useCallback((site: RankedSite) => {
    setSelectedId(site.id);
    map?.flyTo([site.latitude, site.longitude], Math.max(6, map.getZoom()), { duration: 0.6 });
  }, [map]);

  const visibleStatus = requestKey === activeDates.join("|") ? status : "loading";
  const visibleError = requestKey === activeDates.join("|") ? error : "";
  const hasUsableData = ranked.some((site) => site.window.score != null);

  return (
    <div className="fireglow-root app-shell">
      <ProductHeader
        mark={<Flame size={18} aria-hidden="true" />}
        markClassName="fireglow-mark"
        eyebrow="逐霞"
        title="火烧云条件地图"
      >
        <div className="fireglow-controls">
          <div className="segmented" role="group" aria-label="晨昏窗口">
            <button type="button" aria-pressed={phase === "evening"} className={phase === "evening" ? "active" : ""} onClick={() => setPhase("evening")}>
              <Sunset size={14} aria-hidden="true" /> 晚霞
            </button>
            <button type="button" aria-pressed={phase === "morning"} className={phase === "morning" ? "active" : ""} onClick={() => setPhase("morning")}>
              <Sunrise size={14} aria-hidden="true" /> 朝霞
            </button>
          </div>
          <div className="segmented" role="group" aria-label="预测日期" data-mode="range">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={rangeMode === option.value}
                className={rangeMode === option.value ? "active" : ""}
                title={option.hint}
                onClick={() => setRangeMode(option.value)}
              >
                {rangeOptionLabel(option, baseDate)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fireglow-refresh"
            onClick={() => load(activeDates, { force: true })}
            disabled={visibleStatus === "loading"}
            aria-label="强制刷新火烧云快照"
          >
            <RefreshCw size={14} className={status === "loading" ? "is-spinning" : ""} aria-hidden="true" />
            {visibleStatus === "loading" ? "读取中" : "刷新"}
          </button>
        </div>
      </ProductHeader>

      <div className="fireglow-model-note" role="note">
        条件指数由云层结构、能见度与太阳高度启发式映射，尚未完成长期实拍事件概率校准；地图色面为点位条件指数的 IDW 插值，不是卫星或雷达像素场。
      </div>

      <main
        className="fireglow-workspace"
        data-inspector-open={selectedSite ? "true" : "false"}
      >
        <div className="fireglow-map" aria-label="火烧云条件指数地图">
          <MapContainer
            ref={setMap}
            center={[35.5, 104.5]}
            zoom={4}
            minZoom={3}
            maxZoom={12}
            zoomControl
            attributionControl
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              url={BASEMAP_TILE_URL}
              subdomains={BASEMAP_SUBDOMAINS}
              attribution={BASEMAP_ATTRIBUTION}
              className={BASEMAP_TILE_CLASS_NAME}
            />
            {overlay && (
              <ImageOverlay
                url={overlay.url}
                bounds={overlay.bounds}
                interactive={false}
                zIndex={260}
                alt="火烧云条件指数分布色块"
              />
            )}
            <ChineseLabelLayer />
            <BoundaryLayers />
            {ranked.map((site) => {
              const level = markerLevelFor(
                site.window.score,
                site.window.probabilityLevel,
              );
              const isUnknown = level === "unknown";
              const color = isUnknown
                ? UNKNOWN_MARKER_COLOR
                : LEVEL_COLORS[level];
              return (
                <CircleMarker
                  key={site.id}
                  center={[site.latitude, site.longitude]}
                  radius={isUnknown ? 3 : 3 + (site.window.score! / 100) * 3.5}
                  pathOptions={{
                    color: site.id === selectedId ? "#ffffff" : color,
                    fillColor: color,
                    fillOpacity: isUnknown ? 0.38 : 0.82,
                    dashArray: isUnknown ? "3 3" : undefined,
                    weight: site.id === selectedId ? 3 : 1.5,
                  }}
                  eventHandlers={{ click: () => setSelectedId(site.id) }}
                >
                  <Popup>
                    <div className="fireglow-popup">
                      <strong>{site.name}</strong>
                      <span>{site.window.probabilityLabel ?? "—"}</span>
                      {isUnknown ? <span>数据不足</span> : null}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
            <MapScrollControl />
            <MapTileStatus />
          </MapContainer>
          {dataQualityNotice ? (
            <div className="fireglow-map-status" role="status">
              {dataQualityNotice}
            </div>
          ) : null}
          <div className="fireglow-legend" aria-label="火烧云条件指数等级色阶">
            <span>火烧云条件指数</span>
            {LEVEL_LABELS.map((entry) => (
              <span key={entry.level}>
                <i style={{ background: LEVEL_COLORS[entry.level] }} />
                {entry.range}
              </span>
            ))}
            <span>
              <i
                className="fireglow-legend-unknown"
                style={{ background: UNKNOWN_MARKER_COLOR }}
              />
              数据不足
            </span>
          </div>
        </div>

        <aside className="fireglow-panel" aria-label="火烧云条件指数排行">
          <div className="fireglow-panel-head">
            <strong>{phase === "evening" ? "晚霞条件排行" : "朝霞条件排行"}{rangeMode === 3 ? " · 三日最佳" : ` · ${dateLabel(activeDates[0])}`}</strong>
            <span>{dataQualityNotice || (visibleStatus === "error" && !hasUsableData ? "数据不可用" : visibleStatus === "loading" ? "正在更新" : `符合 ≥${scoreThreshold}分 ${filteredRanked.length} 个点位`)}</span>
          </div>
          <ScoreThresholdControl
            value={scoreThreshold}
            count={filteredRanked.length}
            label={phase === "evening" ? "晚霞参考门槛" : "朝霞参考门槛"}
            testId="fireglow-score-threshold"
            onChange={setScoreThreshold}
          />
          {visibleError && <p className="fireglow-error" role="status">{visibleError}</p>}
          <ol className="fireglow-list">
            {visibleStatus === "error" && !hasUsableData ? (
              <li className="fireglow-empty fireglow-empty--error">暂无有效火烧云数据，请刷新重试</li>
            ) : filteredRanked.length ? filteredRanked.map((site, index) => (
              <li key={site.id}>
                <button
                  type="button"
                  className={selectedId === site.id ? "active" : ""}
                  onClick={() => focusSite(site)}
                >
                  <span className="fireglow-rank">{index + 1}</span>
                  <span className="fireglow-site-copy">
                    <strong>{site.name}</strong>
                    <small>
                      {site.province}
                      {site.window.peakTime ? ` · 最佳 ${site.window.peakTime}` : ""}
                      {site.window.momentLabel ? ` · ${site.window.momentLabel}` : ""}
                    </small>
                    <em>
                      {site.window.vividness != null ? `鲜艳度 ${site.window.vividness.toFixed(2)}` : "鲜艳度 —"}
                      {site.window.goldenTime ? ` · 金色 ${site.window.goldenTime}` : ""}
                      {site.window.blueTime ? ` · 蓝色 ${site.window.blueTime}` : ""}
                    </em>
                    {site.days && (
                      <span className="fireglow-day-chips" aria-label="三日条件指数">
                        {site.days.map((day) => (
                          <i key={day.date} data-level={day.level ?? "none"}>
                            {formatCalendarDate(day.date)} {day.score ?? "—"}
                          </i>
                        ))}
                      </span>
                    )}
                  </span>
                  <span
                    className="fireglow-score"
                    data-level={markerLevelFor(
                      site.window.score,
                      site.window.probabilityLevel,
                    )}
                  >
                    <b>{site.window.probabilityLabel ?? "—"}</b>
                    <small>{site.window.bandLabel}</small>
                  </span>
                </button>
              </li>
            )) : (
              <li className="fireglow-empty">{visibleStatus === "loading" ? "正在读取所选日期的数据…" : `暂无达到 ≥${scoreThreshold} 分的地点`}</li>
            )}
          </ol>
          <p className="fireglow-footnote">
            条件指数 = 云种加权画布（高云×0.75 / 中云×0.45 / 低云×0.10，口径来自开源 weather-sunset-predictor）
            + 分相太阳高度（-6~+5°）+ 低云遮挡/能见度/阵风修正。气溶胶（CAMS AOD）为规划增强项；该指数不是实拍校准概率。
          </p>
        </aside>

        {selectedSite ? (
          <ResponsiveTopicDetail
            label={`${selectedSite.name}火烧云摄影详情`}
            className="fireglow-detail-layer"
            onClose={() => setSelectedId(null)}
          >
            <FireglowSiteDetail
              site={selectedSite}
              phase={phase}
              dateKey={selectedDateKey}
              dataQualityNotice={dataQualityNotice}
              onClose={() => setSelectedId(null)}
            />
          </ResponsiveTopicDetail>
        ) : null}
      </main>
    </div>
  );
}
