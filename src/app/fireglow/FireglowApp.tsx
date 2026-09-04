"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sunrise, Sunset, Flame, RefreshCw, MoonStar } from "lucide-react";
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

type Phase = "evening" | "morning";
/** today-0 / +1 / +2 / 三日总览 */
type RangeMode = 0 | 1 | 2 | 3;

// 概率分级色阶：低→高 灰/绿/黄/橙 + 红三级递深（80–88 正红、88–95 深红、95–100 绛红）。
const LEVEL_COLORS: Record<FireGlowProbabilityLevel, string> = {
  p20: "#5f7078",
  p40: "#5da46b",
  p60: "#d4b273",
  p80: "#e08a3f",
  p88: "#e07a2f",
  p95: "#c45c1e",
  p100: "#a84814",
};
const LEVEL_LABELS: Array<{ level: FireGlowProbabilityLevel; range: string }> = [
  { level: "p20", range: "0–20%" },
  { level: "p40", range: "20–40%" },
  { level: "p60", range: "40–60%" },
  { level: "p80", range: "60–80%" },
  { level: "p88", range: "80–88%" },
  { level: "p95", range: "88–95%" },
  { level: "p100", range: "95–100%" },
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
  const [, month, day] = date.split("-").map(Number);
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][
    new Date(`${date}T12:00:00Z`).getUTCDay()
  ];
  return `${month}/${day} 周${weekday}`;
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
  /** 三日总览：每天的概率级（p20…p100）与分数。 */
  days?: Array<{ date: string; score: number | null; level: FireGlowProbabilityLevel | null }>;
}

export default function FireglowApp() {
  const [rangeMode, setRangeMode] = useState<RangeMode>(0);
  const [phase, setPhase] = useState<Phase>("evening");
  const [snapshots, setSnapshots] = useState<Record<string, FireGlowSnapshot | null>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loadTokenRef = useRef(0);
  /** Dates already given their one automatic forced retry after a degraded read. */
  const autoForcedRef = useRef<Set<string>>(new Set());
  const loadRef = useRef<(dates: string[], options?: { force?: boolean }) => () => void>(
    () => () => undefined,
  );

  const baseDate = todayKey();
  const activeDates = useMemo(
    () => (rangeMode === 3 ? [0, 1, 2].map((offset) => shiftDate(baseDate, offset)) : [shiftDate(baseDate, rangeMode)]),
    [baseDate, rangeMode],
  );

  const load = useCallback(
    (dates: string[], { force = false }: { force?: boolean } = {}) => {
      const token = loadTokenRef.current + 1;
      loadTokenRef.current = token;
      const controller = new AbortController();
      queueMicrotask(() => {
        setStatus("loading");
        Promise.all(
          dates.map((date) =>
            fetch(
              `/api/fireglow/snapshot?date=${date}${force ? "&refresh=1" : ""}`,
              { signal: controller.signal, cache: "no-store" },
            )
              .then(async (response) => {
                const payload = await response.json().catch(() => null);
                if (!response.ok || !payload?.sites) throw new Error(payload?.error ?? "火烧云快照不可用");
                return payload as FireGlowSnapshot;
              }),
          ),
        )
          .then((results) => {
            if (loadTokenRef.current !== token) return;
            setSnapshots((current) => {
              const next = { ...current };
              results.forEach((snapshot) => {
                next[snapshot.date] = snapshot;
              });
              return next;
            });
            setStatus("ready");
            const degraded = results.filter((snapshot) => snapshot.stale || snapshot.refreshError);
            setError(
              degraded.length
                ? degraded
                    .map((snapshot) => snapshot.refreshError ?? "部分数据已降级，结果仅供参考。")
                    .join(" ")
                : "",
            );
            // One silent forced retry per date when the plain read came back
            // degraded or without a single usable score.
            const needForce = results.filter(
              (snapshot) =>
                (snapshot.stale || snapshot.refreshError) &&
                !autoForcedRef.current.has(`${snapshot.date}|${snapshot.model}`),
            );
            if (needForce.length && !force) {
              needForce.forEach((snapshot) =>
                autoForcedRef.current.add(`${snapshot.date}|${snapshot.model}`),
              );
              queueMicrotask(() =>
                loadRef.current(needForce.map((snapshot) => snapshot.date), { force: true }),
              );
            }
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
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const missing = activeDates.filter((date) => !snapshots[date]);
    if (!missing.length) return;
    const cleanup = load(missing);
    return cleanup;
    // snapshots intentionally not a dependency: only fetch what's missing on range change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDates, load]);

  const ranked = useMemo<RankedSite[]>(() => {
    const primary = snapshots[activeDates[0]];
    if (!primary) return [];
    return OBSERVING_SITES.map((site) => {
      const windows = activeDates.map((date) => snapshots[date]?.sites[site.id]?.[phase] ?? UNKNOWN_WINDOW);
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
              level: windows[index].probabilityLevel,
            }))
          : undefined,
      };
    }).sort((left, right) => (right.window.score ?? -1) - (left.window.score ?? -1));
  }, [activeDates, phase, rangeMode, snapshots]);

  /** 面状概率色块：IDW 插值出的连续色场，随窗口/日期重算。 */
  const overlay = useMemo(() => {
    if (!ranked.length) return null;
    return buildProbabilityOverlay(
      ranked.map((site) => ({ latitude: site.latitude, longitude: site.longitude, score: site.window.score })),
    );
  }, [ranked]);

  const bestCount = ranked.filter((site) => {
    const level = site.window.probabilityLevel;
    return level === "p80" || level === "p100";
  }).length;
  const selectedSite = ranked.find((site) => site.id === selectedId) ?? null;

  const focusSite = useCallback((site: RankedSite) => {
    setSelectedId(site.id);
    map?.flyTo([site.latitude, site.longitude], Math.max(6, map.getZoom()), { duration: 0.6 });
  }, [map]);

  return (
    <div className="fireglow-root app-shell">
      <ProductHeader
        mark={<Flame size={18} aria-hidden="true" />}
        markClassName="fireglow-mark"
        eyebrow="逐霞"
        title="火烧云概率地图"
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
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fireglow-refresh"
            onClick={() => load(activeDates, { force: true })}
            disabled={status === "loading"}
            aria-label="强制刷新火烧云快照"
          >
            <RefreshCw size={14} className={status === "loading" ? "is-spinning" : ""} aria-hidden="true" />
            {status === "loading" ? "读取中" : "刷新"}
          </button>
        </div>
      </ProductHeader>

      <main
        className="fireglow-workspace"
        data-inspector-open={selectedSite ? "true" : "false"}
      >
        <div className="fireglow-map" aria-label="火烧云概率地图">
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
                alt="火烧云概率分布色块"
              />
            )}
            <ChineseLabelLayer />
            <BoundaryLayers />
            {ranked.map((site) => (
              <CircleMarker
                key={site.id}
                center={[site.latitude, site.longitude]}
                radius={site.window.score == null ? 3 : 3 + (site.window.score / 100) * 3.5}
                pathOptions={{
                  color: site.id === selectedId ? "#ffffff" : LEVEL_COLORS[site.window.probabilityLevel ?? "p20"],
                  fillColor: LEVEL_COLORS[site.window.probabilityLevel ?? "p20"],
                  fillOpacity: 0.82,
                  weight: site.id === selectedId ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => setSelectedId(site.id) }}
              >
                <Popup>
                  <div className="fireglow-popup">
                    <strong>{site.name}</strong>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <div className="fireglow-legend" aria-label="火烧云概率等级色阶">
            <span>火烧云概率</span>
            {LEVEL_LABELS.map((entry) => (
              <span key={entry.level}>
                <i style={{ background: LEVEL_COLORS[entry.level] }} />
                {entry.range}
              </span>
            ))}
          </div>
        </div>

        <aside className="fireglow-panel" aria-label="火烧云概率排行">
          <div className="fireglow-panel-head">
            <strong>{phase === "evening" ? "晚霞概率排行" : "朝霞概率排行"}{rangeMode === 3 ? " · 三日最佳" : ` · ${dateLabel(activeDates[0])}`}</strong>
            <span>60% 以上 {bestCount} 个点位</span>
          </div>
          {status === "error" && <p className="fireglow-error" role="status">{error}</p>}
          {error && status === "ready" && <p className="fireglow-note" role="status">{error}</p>}
          <ol className="fireglow-list">
            {ranked.map((site, index) => (
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
                      <span className="fireglow-day-chips" aria-label="三日概率">
                        {site.days.map((day) => (
                          <i key={day.date} data-level={day.level ?? "none"}>
                            {day.date.slice(5).replace("-", "/")} {day.score ?? "—"}
                          </i>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="fireglow-score" data-level={site.window.probabilityLevel ?? "none"}>
                    <b>{site.window.probabilityLabel ?? "—"}</b>
                    <small>{site.window.bandLabel}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="fireglow-footnote">
            概率 = 云种加权画布（高云×0.75 / 中云×0.45 / 低云×0.10，口径来自开源 weather-sunset-predictor）
            + 分相太阳高度（-6~+5°）+ 低云遮挡/能见度/阵风修正。气溶胶（CAMS AOD）为规划增强项。
          </p>
        </aside>

        {selectedSite ? (
          <aside className="fireglow-inspector" aria-label="选中点详情">
            <strong>{selectedSite.name}</strong>
            <span>
              {selectedSite.province} · {selectedSite.altitude == null ? "海拔待核" : `${Math.round(selectedSite.altitude)}m`}
            </span>
            <b data-level={selectedSite.window.probabilityLevel ?? "none"}>
              概率 {selectedSite.window.probabilityLabel ?? "—"} · {selectedSite.window.bandLabel}
            </b>
            <small>
              高云 {selectedSite.window.highCloud ?? "—"}% / 中云 {selectedSite.window.midCloud ?? "—"}% / 低云 {selectedSite.window.lowCloud ?? "—"}%
              {selectedSite.window.visibilityKm != null ? ` · 能见度 ${selectedSite.window.visibilityKm}km` : ""}
            </small>
            <small>
              {selectedSite.window.momentLabel ?? ""}
              {selectedSite.window.peakTime ? ` · 最佳 ${selectedSite.window.peakTime}` : ""}
              {selectedSite.window.vividness != null ? ` · 鲜艳度 ${selectedSite.window.vividness.toFixed(2)}` : ""}
            </small>
            <small className="fireglow-popup-twilight">
              <MoonStar size={11} aria-hidden="true" />
              金色 {selectedSite.window.goldenTime ?? "—"} · 蓝色 {selectedSite.window.blueTime ?? "—"} · 天文{phase === "evening" ? "昏影终" : "晨光始"} {selectedSite.window.astroTime ?? "—"}
            </small>
          </aside>
        ) : null}
      </main>
    </div>
  );
}
