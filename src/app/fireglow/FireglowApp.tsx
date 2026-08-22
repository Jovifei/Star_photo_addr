"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sunrise, Sunset, Flame, RefreshCw } from "lucide-react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import ChineseLabelLayer from "@/components/ChineseLabelLayer";
import BoundaryLayers from "@/components/BoundaryLayers";
import { CARTO_ATTRIBUTION, CARTO_DARK_NOLABELS_URL } from "@/lib/constants";
import { OBSERVING_SITES } from "@/lib/observingSites";
import type { FireGlowSnapshot, FireGlowWindowScore } from "@/lib/fireglow";
import { fireGlowBandLabel } from "@/lib/fireglow";
import type { FireGlowBand } from "@/lib/fireglow";

type Phase = "evening" | "morning";

const BAND_COLORS: Record<FireGlowBand, string> = {
  strong: "#e8654f",
  medium: "#d4915f",
  light: "#c9b273",
  faint: "#5f7078",
  none: "#3c4a52",
  unknown: "#3c4a52",
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

interface RankedSite {
  id: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  window: FireGlowWindowScore;
}

export default function FireglowApp() {
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<Phase>("evening");
  const [snapshot, setSnapshot] = useState<FireGlowSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const baseDate = todayKey();
  const date = shiftDate(baseDate, offset);
  const requestKey = `${date}|${phase}`;

  const load = useCallback(
    (silent = false) => {
      const controller = new AbortController();
      queueMicrotask(() => {
        if (!silent) setStatus("loading");
        fetch(`/api/fireglow/snapshot?date=${date}`, { signal: controller.signal, cache: "no-store" })
          .then(async (response) => {
            const payload = await response.json().catch(() => null);
            if (!response.ok || !payload?.sites) throw new Error(payload?.error ?? "火烧云快照不可用");
            return payload as FireGlowSnapshot;
          })
          .then((payload) => {
            setSnapshot(payload);
            setStatus("ready");
            setError(payload.stale ? "部分数据已降级，结果仅供参考。" : "");
          })
          .catch((requestError) => {
            if (requestError?.name === "AbortError") return;
            setStatus("error");
            setError(requestError instanceof Error ? requestError.message : "火烧云快照不可用");
          });
      });
      return () => controller.abort();
    },
    [date],
  );

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, [load]);

  const ranked = useMemo<RankedSite[]>(() => {
    if (!snapshot) return [];
    return OBSERVING_SITES.map((site) => ({
      id: site.id,
      name: site.name,
      province: site.province,
      latitude: site.latitude,
      longitude: site.longitude,
      altitude: site.altitude,
      window: snapshot.sites[site.id]?.[phase] ?? {
        score: null,
        band: "unknown" as FireGlowBand,
        bandLabel: fireGlowBandLabel("unknown"),
        peakTime: null,
        deckCloud: null,
        lowCloud: null,
        visibilityKm: null,
        sunAltitude: null,
        reason: "暂无数据",
      },
    })).sort((left, right) => (right.window.score ?? -1) - (left.window.score ?? -1));
  }, [phase, snapshot]);

  const bestCount = ranked.filter((site) => site.window.band === "strong" || site.window.band === "medium").length;

  const focusSite = useCallback((site: RankedSite) => {
    setSelectedId(site.id);
    map?.flyTo([site.latitude, site.longitude], Math.max(6, map.getZoom()), { duration: 0.6 });
  }, [map]);

  return (
    <div className="fireglow-root app-shell">
      <header className="topbar fireglow-topbar">
        <div className="fireglow-head">
          <span className="fireglow-mark"><Flame size={18} aria-hidden="true" /></span>
          <div>
            <span className="section-kicker">火烧云预测 · 晨昏窗口</span>
            <h1>火烧云地图</h1>
          </div>
        </div>
        <div className="fireglow-controls">
          <div className="segmented" role="group" aria-label="预测日期">
            {[0, 1, 2].map((value) => (
              <button key={value} type="button" aria-pressed={offset === value} className={offset === value ? "active" : ""} onClick={() => setOffset(value)}>
                {value === 0 ? "今天" : value === 1 ? "明天" : "后天"}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label="晨昏窗口">
            <button type="button" aria-pressed={phase === "evening"} className={phase === "evening" ? "active" : ""} onClick={() => setPhase("evening")}>
              <Sunset size={14} aria-hidden="true" /> 傍晚晚霞
            </button>
            <button type="button" aria-pressed={phase === "morning"} className={phase === "morning" ? "active" : ""} onClick={() => setPhase("morning")}>
              <Sunrise size={14} aria-hidden="true" /> 清晨朝霞
            </button>
          </div>
          <button type="button" className="fireglow-refresh" onClick={() => load()} disabled={status === "loading"}>
            <RefreshCw size={14} className={status === "loading" ? "is-spinning" : ""} aria-hidden="true" />
            {status === "loading" ? "读取中" : "刷新"}
          </button>
        </div>
      </header>

      <main className="fireglow-workspace">
        <aside className="fireglow-panel" aria-label="火烧云地点排行">
          <div className="fireglow-panel-head">
            <strong>{phase === "evening" ? "傍晚窗口排行" : "清晨窗口排行"}</strong>
            <span>{dateLabel(date)} · 中烧及以上 {bestCount} 个</span>
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
                    <small>{site.province} · {site.altitude == null ? "海拔待核" : `${Math.round(site.altitude)}m`}{site.window.peakTime ? ` · 最佳 ${site.window.peakTime}` : ""}</small>
                    <em>{site.window.reason}</em>
                  </span>
                  <span className="fireglow-score" data-band={site.window.band}>
                    <b>{site.window.score ?? "—"}</b>
                    <small>{site.window.bandLabel}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="fireglow-footnote">
            评分 = 中高云量结构（点燃的画布）+ 太阳高度角（晨昏几何）+ 低云遮挡与能见度修正。
            气溶胶（CAMS AOD）为规划中的增强项；出发前请对照实况云图。
          </p>
        </aside>

        <div className="fireglow-map" aria-label="火烧云评分地图">
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
            <TileLayer url={CARTO_DARK_NOLABELS_URL} attribution={CARTO_ATTRIBUTION} />
            <ChineseLabelLayer />
            <BoundaryLayers />
            {ranked.map((site) => (
              <CircleMarker
                key={site.id}
                center={[site.latitude, site.longitude]}
                radius={site.window.score == null ? 4 : 4 + (site.window.score / 100) * 8}
                pathOptions={{
                  color: site.id === selectedId ? "#ffffff" : BAND_COLORS[site.window.band],
                  fillColor: BAND_COLORS[site.window.band],
                  fillOpacity: 0.8,
                  weight: site.id === selectedId ? 3 : 1.5,
                }}
                eventHandlers={{ click: () => setSelectedId(site.id) }}
              >
                <Popup>
                  <div className="fireglow-popup">
                    <strong>{site.name}</strong>
                    <span>{site.province}</span>
                    <b data-band={site.window.band}>{site.window.score ?? "—"} · {site.window.bandLabel}</b>
                    <small>{site.window.reason}</small>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <div className="fireglow-legend" aria-label="火烧云等级图例">
            {(["strong", "medium", "light", "faint"] as FireGlowBand[]).map((band) => (
              <span key={band}><i style={{ background: BAND_COLORS[band] }} />{fireGlowBandLabel(band)}</span>
            ))}
          </div>
        </div>
      </main>
      <span hidden data-request-key={requestKey} />
    </div>
  );
}
