"use client";

import type { Map as LeafletMap } from "leaflet";
import {
  ChevronDown,
  ChevronUp,
  LocateFixed,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useStore } from "@/lib/store";
import {
  OBSERVING_SITES,
  observingSiteToLocation,
  recommendationLabel,
} from "@/lib/observingSites";
import { scoreDateForForecastTime } from "@/lib/nighttime";
import {
  dominantProvince,
  MIN_VIEWPORT_RECOMMENDATION_ZOOM,
  rankViewportRecommendations,
  siteInsideViewport,
  viewportKey,
  type MapViewport,
  type ViewportRecommendation,
} from "@/lib/viewportRecommendations";
import type { ObservationSnapshot } from "@/lib/types";

const REQUEST_TIMEOUT_MS = 30_000;

function readViewport(map: LeafletMap): MapViewport {
  const bounds = map.getBounds();
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    zoom: map.getZoom(),
  };
}

function isMatchingSnapshot(
  snapshot: ObservationSnapshot,
  date: string,
  model: string,
  focusTime: string | null,
): boolean {
  return (
    snapshot.date === date &&
    snapshot.model === model &&
    (focusTime ? snapshot.focusTime === focusTime : !snapshot.focusTime)
  );
}

export default function ViewportRecommendationPanel({
  mapRef,
  ready,
  onRecommendationsChange,
}: {
  mapRef: RefObject<LeafletMap | null>;
  ready: boolean;
  onRecommendationsChange: (items: ViewportRecommendation[]) => void;
}) {
  const { state, selectLocation, setDetailOpen } = useStore();
  const [collapsed, setCollapsed] = useState(true);
  const [liveViewport, setLiveViewport] = useState<MapViewport | null>(null);
  const [appliedViewportKey, setAppliedViewportKey] = useState("");
  const [appliedContextKey, setAppliedContextKey] = useState("");
  const [recommendations, setRecommendations] = useState<ViewportRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const snapshotRef = useRef<ObservationSnapshot | null>(null);
  const snapshotContextRef = useRef("");
  const requestRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1180px)");
    setCollapsed(media.matches);
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const report = () => setLiveViewport(readViewport(map));
    report();
    map.on("moveend", report);
    map.on("zoomend", report);
    return () => {
      map.off("moveend", report);
      map.off("zoomend", report);
    };
  }, [mapRef, ready]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
    },
    [],
  );

  const activeForecastTime = state.cloudState.activeForecastTime ?? null;
  const scoreDate = scoreDateForForecastTime(
    activeForecastTime,
    state.selectedNight,
  );
  const contextKey = [
    scoreDate,
    activeForecastTime ?? "night-summary",
    state.cloudState.model,
    state.observingBortleLimit,
    state.recommendationThreshold,
    state.recommendedOnly,
    [...state.visibleRecommendationBands].sort().join(","),
    state.dataRefreshRevision,
  ].join("|");
  const liveKey = viewportKey(liveViewport);
  const dirty =
    Boolean(recommendations.length || appliedViewportKey) &&
    (liveKey !== appliedViewportKey || contextKey !== appliedContextKey);
  const zoomReady =
    Boolean(liveViewport) &&
    (liveViewport?.zoom ?? 0) >= MIN_VIEWPORT_RECOMMENDATION_ZOOM;

  const viewportSiteCount = useMemo(() => {
    if (!liveViewport) return 0;
    return OBSERVING_SITES.filter(
      (site) =>
        siteInsideViewport(site, liveViewport) &&
        site.bortle <= state.observingBortleLimit,
    ).length;
  }, [liveViewport, state.observingBortleLimit]);

  const applyRecommendations = useCallback(
    (snapshot: ObservationSnapshot | null, viewport: MapViewport) => {
      const next = rankViewportRecommendations(
        OBSERVING_SITES,
        snapshot,
        viewport,
        {
          bortleLimit: state.observingBortleLimit,
          recommendationThreshold: state.recommendationThreshold,
          recommendedOnly: state.recommendedOnly,
          visibleBands: state.visibleRecommendationBands,
        },
      );
      setRecommendations(next);
      onRecommendationsChange(next);
      setAppliedViewportKey(viewportKey(viewport));
      setAppliedContextKey(contextKey);
      return next;
    },
    [
      contextKey,
      onRecommendationsChange,
      state.observingBortleLimit,
      state.recommendationThreshold,
      state.recommendedOnly,
      state.visibleRecommendationBands,
    ],
  );

  const refreshViewport = useCallback(async () => {
    const map = mapRef.current;
    const viewport = map ? readViewport(map) : liveViewport;
    if (!viewport || viewport.zoom < MIN_VIEWPORT_RECOMMENDATION_ZOOM) return;

    setLiveViewport(viewport);
    setError("");
    const currentViewportSiteCount = OBSERVING_SITES.filter(
      (site) =>
        siteInsideViewport(site, viewport) &&
        site.bortle <= state.observingBortleLimit,
    ).length;
    if (currentViewportSiteCount === 0) {
      applyRecommendations(null, viewport);
      return;
    }

    const snapshotContextKey = [
      scoreDate,
      activeForecastTime ?? "night-summary",
      state.cloudState.model,
      state.dataRefreshRevision,
    ].join("|");
    const cachedSnapshot = snapshotRef.current;
    if (
      cachedSnapshot &&
      snapshotContextRef.current === snapshotContextKey &&
      isMatchingSnapshot(
        cachedSnapshot,
        scoreDate,
        state.cloudState.model,
        activeForecastTime,
      )
    ) {
      applyRecommendations(cachedSnapshot, viewport);
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    requestRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        date: scoreDate,
        days: "1",
        model: state.cloudState.model,
      });
      if (activeForecastTime) params.set("time", activeForecastTime);
      const response = await fetch(`/api/observing/snapshot?${params.toString()}`, {
        signal: controller.signal,
        cache: "default",
        headers: { Accept: "application/json" },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "区域推荐评分暂时不可用");
      }
      if (
        controller.signal.aborted ||
        requestRef.current !== controller ||
        requestIdRef.current !== requestId
      ) {
        return;
      }
      const snapshot = payload as ObservationSnapshot;
      if (
        !isMatchingSnapshot(
          snapshot,
          scoreDate,
          state.cloudState.model,
          activeForecastTime,
        )
      ) {
        throw new Error("区域推荐收到的评分时次与当前地图不一致");
      }
      snapshotRef.current = snapshot;
      snapshotContextRef.current = snapshotContextKey;
      applyRecommendations(snapshot, viewport);
    } catch (caught) {
      if (
        requestRef.current !== controller ||
        requestIdRef.current !== requestId
      ) {
        return;
      }
      if (controller.signal.aborted) {
        setError("区域推荐请求超时，请稍后重试");
      } else {
        setError(caught instanceof Error ? caught.message : "区域推荐暂时不可用");
      }
    } finally {
      window.clearTimeout(timeout);
      if (
        requestRef.current === controller &&
        requestIdRef.current === requestId
      ) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }, [
    activeForecastTime,
    applyRecommendations,
    liveViewport,
    mapRef,
    scoreDate,
    state.cloudState.model,
    state.dataRefreshRevision,
  ]);

  const pickRecommendation = useCallback(
    (item: ViewportRecommendation) => {
      const map = mapRef.current;
      void selectLocation(observingSiteToLocation(item.site));
      setDetailOpen(true);
      map?.flyTo(
        [item.site.latitude, item.site.longitude],
        Math.max(8, map.getZoom()),
        { duration: 0.45 },
      );
    },
    [mapRef, selectLocation, setDetailOpen],
  );

  const province = dominantProvince(recommendations);
  const statusText = !ready
    ? "地图加载中"
    : !zoomReady
      ? `放大到 ${MIN_VIEWPORT_RECOMMENDATION_ZOOM} 级以上`
      : `${viewportSiteCount} 个暗夜点位在当前视野`;

  return (
    <section
      className={`viewport-recommendation-panel${collapsed ? " is-collapsed" : ""}`}
      aria-label="当前视野观星地点推荐"
      data-dirty={dirty}
      data-loading={loading}
    >
      <div className="viewport-recommendation-head">
        <div>
          <span className="viewport-recommendation-kicker">
            <Sparkles size={13} aria-hidden="true" /> 当前视野推荐
          </span>
          <strong>{province ? `${province}及周边` : "放大地图生成排行"}</strong>
          <small>{statusText}</small>
        </div>
        <button
          type="button"
          className="viewport-recommendation-collapse"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          aria-controls="viewport-recommendation-body"
          aria-label={collapsed ? "展开当前视野推荐" : "收起当前视野推荐"}
        >
          {collapsed ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
      </div>

      <div id="viewport-recommendation-body" className="viewport-recommendation-body">
        <div className="viewport-recommendation-actions">
          <button
            type="button"
            className="viewport-recommendation-refresh"
            onClick={() => void refreshViewport()}
            disabled={!ready || !zoomReady || loading}
          >
            {loading ? (
              <RefreshCw size={14} className="is-spinning" aria-hidden="true" />
            ) : (
              <LocateFixed size={14} aria-hidden="true" />
            )}
            {loading
              ? "正在生成排行…"
              : recommendations.length
                ? dirty
                  ? "更新此区域"
                  : "重新计算"
                : "生成区域推荐"}
          </button>
          <span>
            {activeForecastTime
              ? `${activeForecastTime.slice(5, 10)} ${activeForecastTime.slice(11, 16)}`
              : `${scoreDate} 夜间`}
            {" · "}{state.cloudState.model.toUpperCase()}
          </span>
        </div>

        {!zoomReady && (
          <p className="viewport-recommendation-empty">
            先把地图放大到省域或城市群，再按当前视野生成最多 12 个地点。移动地图不会自动请求数据。
          </p>
        )}
        {zoomReady && !loading && !recommendations.length && !error && (
          <p className="viewport-recommendation-empty">
            {viewportSiteCount
              ? "点击“生成区域推荐”，按当前时次观星分、Bortle 与海拔排序。"
              : "当前视野内没有符合 Bortle 筛选的整理点位。"}
          </p>
        )}
        {error && <p className="viewport-recommendation-error" role="status">{error}</p>}

        {recommendations.length > 0 && (
          <div className="viewport-recommendation-grid">
            {recommendations.map((item) => (
              <button
                key={item.site.id}
                type="button"
                className="viewport-recommendation-card"
                onClick={() => pickRecommendation(item)}
              >
                <span className="viewport-recommendation-rank">{item.rank}</span>
                <span className="viewport-recommendation-card-main">
                  <span className="viewport-recommendation-card-title">
                    <strong>{item.site.name}</strong>
                    <em data-band={item.score?.band ?? "unknown"}>
                      {recommendationLabel(item.score?.band ?? "unknown")}
                    </em>
                  </span>
                  <small>{item.site.province} · {item.site.area}</small>
                  <span className="viewport-recommendation-stars" aria-label={`${item.stars} 星推荐`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <i key={index} data-filled={index < item.stars}>★</i>
                    ))}
                  </span>
                  <span className="viewport-recommendation-reason">{item.reason}</span>
                  <span className="viewport-recommendation-meta">
                    <b>B{item.site.bortle}</b>
                    <b>{item.site.altitude == null ? "海拔未知" : `海拔 ${Math.round(item.site.altitude)}m`}</b>
                    <b>{item.score?.cloud == null ? "云量 —" : `云量 ${Math.round(item.score.cloud)}%`}</b>
                    <b>{item.score?.score == null ? "观星分 —" : `观星分 ${item.score.score}`}</b>
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        <small className="viewport-recommendation-note">
          编号表示当前视野排行；颜色与推荐档位沿用现有评分。VIIRS 只作人工夜光参考，出发前仍需核对道路与现场条件。
        </small>
      </div>
    </section>
  );
}
