import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw as ArrowsClockwise,
  Binoculars,
  Calendar as CalendarBlank,
  ChevronRight as CaretRight,
  ChartLine as ChartLineUp,
  CircleCheck as CheckCircle,
  Cloud,
  CloudRain,
  Compass,
  Info,
  List as ListBullets,
  MapPin,
  Map as MapTrifold,
  Moon,
  Mountain as Mountains,
  Plus,
  Sparkles as Sparkle,
  TriangleAlert as Warning,
  Telescope,
  Wind,
  X,
} from "lucide-react";
import Link from "next/link";
import { ObservationMap } from "./components/ObservationMap";
import { createLocation } from "./data/locations";
import { deriveCloudLayers } from "./lib/clouds";
import { readCustomLocations, readForecastCache, writeCustomLocations, writeForecastCache } from "./lib/cache";
import { fetchPressureForecast, fetchSurfaceForecasts } from "./lib/openMeteo";
import { evaluateNight, statusMeta } from "./lib/scoring";
import { addDays, formatHour, formatNightLabel, nextNightKeys, relativeFreshness } from "./lib/time";
import HourlyForecastMatrix from "@/components/HourlyForecastMatrix";
import ProductHeader from "@/components/ProductHeader";
import ForecastThemeSwitch from "@/components/ForecastThemeSwitch";
import { useStore } from "@/lib/store";
import { OBSERVING_SITES, observingSiteToLocation, recommendationLabel } from "@/lib/observingSites";
import { rankNearbySitesWithFallback } from "@/lib/locationPresentation";
import { toSimplifiedChinese } from "@/lib/chineseText";
import {
  dedupeLocationIdentities,
  sameLocationIdentity,
} from "@/lib/locationIdentity";

const NAV_ITEMS = [
  { id: "dashboard", label: "今晚", icon: Binoculars },
  { id: "map", label: "地图", icon: MapTrifold },
  { id: "matrix", label: "对比", icon: ChartLineUp },
  { id: "locations", label: "点位", icon: MapPin },
];

const ReactECharts = lazy(() => import("echarts-for-react"));

const PLANNER_DRAWER_WIDTH_KEY = "perseids-planner-detail-width-v1";
const PLANNER_DRAWER_MIN_WIDTH = 420;
const PLANNER_DRAWER_MAX_WIDTH = 920;
const PLANNER_DRAWER_DEFAULT_WIDTH = 720;
const DRAWER_DRAG_RESET_GUARD_MS = 2000;
const PLANNER_NEARBY_KEY = "perseids-planner-nearby-v1";
// 0 关闭；开启后推荐站点会并入排名，但不会写入本机点位列表。
const NEARBY_RADIUS_OPTIONS = [
  { value: 0, label: "关闭" },
  { value: 10, label: "10 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
  { value: 200, label: "200 km" },
];
const NEARBY_RECOMMEND_LIMIT = 8;
const NEARBY_MINIMUM_RESULTS = 3;
const DETAIL_RANGE_OPTIONS = [
  { value: 1, label: "今日", hint: "当前夜" },
  { value: 3, label: "3 天", hint: "短期" },
  { value: 5, label: "5 天", hint: "中期" },
  { value: 7, label: "7 天", hint: "完整周" },
];

function detailNightKeys(startKey, days) {
  return Array.from({ length: days }, (_, index) => addDays(startKey, index));
}

function nightOffset(startKey, nightKey) {
  return detailNightKeys(startKey, 14).indexOf(nightKey);
}

function clampPlannerDrawerWidth(value) {
  const viewportMax = typeof window === "undefined"
    ? PLANNER_DRAWER_MAX_WIDTH
    : Math.max(PLANNER_DRAWER_MIN_WIDTH, window.innerWidth - 360);
  return Math.min(viewportMax, Math.max(PLANNER_DRAWER_MIN_WIDTH, Math.round(value)));
}

function readPlannerDrawerWidth() {
  if (typeof window === "undefined") return null;
  try {
    const saved = Number(localStorage.getItem(PLANNER_DRAWER_WIDTH_KEY));
    return Number.isFinite(saved) ? clampPlannerDrawerWidth(saved) : null;
  } catch {
    return null;
  }
}

function readPlannerNearbyRadius() {
  if (typeof window === "undefined") return 0;
  try {
    const saved = Number(localStorage.getItem(PLANNER_NEARBY_KEY));
    return NEARBY_RADIUS_OPTIONS.some((option) => option.value === saved) ? saved : 0;
  } catch {
    return 0;
  }
}

function rankValue(item, mode) {
  if (item.sharedScore?.score != null) {
    return mode === "cloud"
      ? 100 - (item.sharedScore.cloud ?? 100)
      : item.sharedScore.score;
  }
  return mode === "cloud" ? item.evaluation?.cloudSeaPotential ?? -1 : item.evaluation?.score ?? -1;
}

function recommendationMeta(sharedScore, evaluation) {
  if (!sharedScore?.band) return statusMeta(evaluation?.status);
  const tone = {
    priority: "good",
    recommended: "good",
    watch: "warn",
    "not-recommended": "bad",
    unknown: "muted",
  }[sharedScore.band] ?? "muted";
  return { label: recommendationLabel(sharedScore.band), tone };
}

function useDialogFocus(open, onClose) {
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open || !dialogRef.current) return undefined;
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusableSelector = "button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex='-1'])";
    const focusables = () => Array.from(dialog.querySelectorAll(focusableSelector));
    focusables()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus?.();
    };
  }, [open, onClose]);
  return dialogRef;
}

function readProductBridge() {
  const params = new URLSearchParams(window.location.search);
  const latitudeRaw = params.get("lat");
  const longitudeRaw = params.get("lng");
  const latitude = latitudeRaw === null || latitudeRaw.trim() === "" ? NaN : Number(latitudeRaw);
  const longitude = longitudeRaw === null || longitudeRaw.trim() === "" ? NaN : Number(longitudeRaw);
  const elevationRaw = params.get("elevation");
  const elevation = elevationRaw === null || elevationRaw.trim() === "" ? null : Number(elevationRaw);
  const night = params.get("night");
  const model = params.get("model");
  const forecastTime = params.get("forecastTime");
  const observationTime = params.get("observationTime");
  const overlay = params.get("overlay");
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { location: null, night, model, forecastTime, observationTime, overlay };
  }
  return {
    night,
    model,
    forecastTime,
    observationTime,
    overlay,
    location: {
      id: `perseids-${latitude.toFixed(5)}-${longitude.toFixed(5)}`,
      name: toSimplifiedChinese(params.get("name")?.trim()) || "今夜观测联动点位",
      latitude,
      longitude,
      elevation: Number.isFinite(elevation) ? elevation : null,
      timezone: undefined,
      source: "今夜观测联动",
    },
  };
}

export function App() {
  const {
    state: sharedState,
    selectLocation: selectSharedLocation,
    selectNight: selectSharedNight,
    setCloud: setSharedCloud,
    addCandidate,
  } = useStore();
  const bridge = useMemo(() => readProductBridge(), []);
  const [customLocations, setCustomLocations] = useState(() =>
    dedupeLocationIdentities(readCustomLocations()),
  );
  const locations = useMemo(() => {
    const sharedLocations = sharedState.candidates.map((candidate) => {
      const site = OBSERVING_SITES.find((item) => item.id === candidate.id);
      if (site) return observingSiteToLocation(site);
      return {
        id: candidate.id,
        name: candidate.name,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        elevation: candidate.elevation ?? null,
        source: "自定义",
        bortle: candidate.bortle,
        province: candidate.province,
      };
    });
    const inbound = bridge.location ? [bridge.location] : [];
    // A deep-link record carries the freshest name/elevation, so it wins when
    // older persisted records describe the same coordinates under another ID.
    return dedupeLocationIdentities([
      ...inbound,
      ...sharedLocations,
      ...customLocations,
    ]);
  }, [bridge.location, customLocations, sharedState.candidates]);
  const [days, setDays] = useState(7);
  // 预测主题（星空/云海）是跨产品共享的观察口径，不再作为本页局部参数。
  const mode = sharedState.forecastTheme;
  const [view, setView] = useState("dashboard");
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(readPlannerNearbyRadius);
  const tonightNight = nextNightKeys(14)[0];
  const [rangeStartNight, setRangeStartNight] = useState(() =>
    bridge.night && nextNightKeys(14).includes(bridge.night) ? bridge.night : sharedState.selectedNight,
  );
  const [selectedNight, setSelectedNight] = useState(() =>
    bridge.night && nextNightKeys(14).includes(bridge.night)
      ? bridge.night
      : sharedState.selectedNight,
  );
  // URL 点位只参与排名与会话联动；落地时不再自动弹出地点详情抽屉，
  // 让用户先看到观星计划全貌，需要下钻时自行点击。
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [forecasts, setForecasts] = useState(() => readForecastCache()?.forecasts ?? []);
  const [savedAt, setSavedAt] = useState(() => readForecastCache()?.savedAt ?? null);
  const [stale, setStale] = useState(() => readForecastCache()?.stale ?? false);
  const [observationSnapshot, setObservationSnapshot] = useState(null);
  const [snapshotStatus, setSnapshotStatus] = useState("idle");
  const [snapshotAttemptKey, setSnapshotAttemptKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sharedModel = sharedState.cloudState.model;
  const nightKeys = useMemo(() => detailNightKeys(rangeStartNight, days), [days, rangeStartNight]);
  const snapshotStartNight = nightKeys[0] ?? selectedNight;
  const snapshotRequestKey = `${snapshotStartNight}|${days}|${sharedModel}`;
  const activeObservationSnapshot = snapshotAttemptKey === snapshotRequestKey &&
    observationSnapshot?.date === snapshotStartNight &&
    observationSnapshot?.days === days &&
    observationSnapshot?.model === sharedModel
    ? observationSnapshot
    : null;
  const displayedSnapshotStatus = snapshotAttemptKey === snapshotRequestKey ? snapshotStatus : locations.length ? "loading" : "idle";
  const isSpecifiedNight = Boolean(bridge.night && selectedNight === bridge.night && selectedNight !== tonightNight);

  // 附近推荐：以首个候选点为锚点，从全国观测点库中按距离圈选参考点位。
  // 它们只参与排名与会话内详情，不写入本机候选列表。
  const nearbyAnchor = locations[0] ?? null;
  const recommendedLocations = useMemo(() => {
    if (!nearbyRadiusKm || !nearbyAnchor) return [];
    return rankNearbySitesWithFallback(
      nearbyAnchor,
      nearbyRadiusKm,
      activeObservationSnapshot,
      NEARBY_RECOMMEND_LIMIT + locations.length,
      NEARBY_MINIMUM_RESULTS + locations.length,
    )
      .filter((item) =>
        !locations.some((location) =>
          sameLocationIdentity(location, observingSiteToLocation(item.site)),
        ),
      )
      .slice(0, NEARBY_RECOMMEND_LIMIT)
      .map((item) => ({
        ...observingSiteToLocation(item.site),
        source: "附近推荐",
        distanceKm: Math.round(item.distanceKm),
        nearbyFallback: item.isFallback,
      }));
  }, [activeObservationSnapshot, locations, nearbyAnchor, nearbyRadiusKm]);
  const rankingPool = useMemo(
    () => dedupeLocationIdentities([...locations, ...recommendedLocations]),
    [locations, recommendedLocations],
  );

  const refresh = useCallback(
    async (silent = false) => {
      if (!rankingPool.length) return;
      if (!silent) setLoading(true);
      setError("");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25000);
      try {
        const data = await fetchSurfaceForecasts(rankingPool, 14, controller.signal, sharedModel);
        const cache = writeForecastCache(data);
        setForecasts(data);
        setSavedAt(cache.savedAt);
        setStale(false);
      } catch (requestError) {
        setError(requestError.name === "AbortError" ? "天气数据请求超时，已保留上一次成功数据。" : `${requestError.message}，已保留上一次成功数据。`);
        if (forecasts.length) setStale(true);
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    },
    [rankingPool, forecasts.length, sharedModel],
  );

  useEffect(() => {
    if (bridge.night && nextNightKeys(14).includes(bridge.night)) {
      selectSharedNight(bridge.night);
    }
    if (bridge.model === "icon" || bridge.model === "gfs" || bridge.model === "aifs") {
      setSharedCloud({ model: bridge.model });
    }
    if (bridge.overlay === "satellite-cloud" || bridge.overlay === "forecast-cloud" || bridge.overlay === "night-lights") {
      setSharedCloud({ overlayMode: bridge.overlay });
    }
    if (bridge.forecastTime || bridge.observationTime) {
      setSharedCloud({
        activeForecastTime: bridge.forecastTime ?? sharedState.cloudState.activeForecastTime,
        activeObservationTime: bridge.observationTime ?? sharedState.cloudState.activeObservationTime,
      });
    }
    if (bridge.location) {
      // A deep link participates in this planning session but is not silently
      // persisted as a user candidate. Saving remains an explicit action.
      void selectSharedLocation(bridge.location, bridge.model);
    }
    // The bridge is a mount-time protocol; user edits thereafter remain local
    // to the planner until the next explicit navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialRefreshStarted = useRef(false);
  useEffect(() => {
    if (!locations.length) return;
    if (initialRefreshStarted.current) return;
    initialRefreshStarted.current = true;
    const missingBridgeForecast =
      bridge.location &&
      !forecasts.some((item) => item.locationId === bridge.location.id);
    if (!forecasts.length || stale || missingBridgeForecast) {
      queueMicrotask(() => void refresh(true));
    }
  }, [bridge.location, forecasts, locations.length, refresh, stale]);

  const previousModelRef = useRef(sharedModel);
  useEffect(() => {
    if (previousModelRef.current === sharedModel) return;
    previousModelRef.current = sharedModel;
    void refresh();
  }, [refresh, sharedModel]);

  // The ranking overview uses the same server snapshot as the map. The
  // existing point forecast remains the detail Adapter for hourly drill-down.
  useEffect(() => {
    if (!locations.length) return undefined;
    const controller = new AbortController();
    const params = new URLSearchParams({ date: snapshotStartNight, days: String(days), model: sharedModel });
    fetch(`/api/observing/snapshot?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? "观星评分快照不可用");
        return payload;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setObservationSnapshot(payload);
        setSnapshotAttemptKey(snapshotRequestKey);
        setSnapshotStatus(payload?.stale ? "degraded" : "available");
      })
      .catch((requestError) => {
        if (requestError?.name !== "AbortError" && !controller.signal.aborted) {
          setSnapshotStatus("degraded");
          setSnapshotAttemptKey(snapshotRequestKey);
          setObservationSnapshot(null);
        }
      });
    return () => controller.abort();
  }, [days, locations.length, sharedModel, snapshotRequestKey, snapshotStartNight]);

  useEffect(() => {
    writeCustomLocations(customLocations);
  }, [customLocations]);

  useEffect(() => {
    try {
      localStorage.setItem(PLANNER_NEARBY_KEY, String(nearbyRadiusKm));
    } catch {
      // 推荐偏好是渐进增强，写入失败不影响当前会话。
    }
  }, [nearbyRadiusKm]);

  // 开启推荐或锚点变化后，为新推荐的点位静默补拉逐小时预报；
  // 每组点位只自动尝试一次，失败后仍可用顶部刷新按钮手动重试。
  const nearbyForecastAttemptRef = useRef("");
  useEffect(() => {
    if (!recommendedLocations.length) return;
    const attemptKey = recommendedLocations.map((item) => item.id).join(",");
    if (nearbyForecastAttemptRef.current === attemptKey) return;
    const missing = recommendedLocations.some((item) => !forecasts.some((forecast) => forecast.locationId === item.id));
    if (!missing || loading) return;
    nearbyForecastAttemptRef.current = attemptKey;
    queueMicrotask(() => void refresh(true));
  }, [forecasts, loading, recommendedLocations, refresh]);

  function changeDays(value) {
    const nextKeys = detailNightKeys(rangeStartNight, value);
    setDays(value);
    if (!nextKeys.includes(selectedNight)) {
      const nextNight = nextKeys[0] ?? tonightNight;
      setSelectedNight(nextNight);
      selectSharedNight(nextNight);
    }
  }

  // 切换顶部/底部导航（今晚·对比·点位）时自动回到页面顶部，避免跳转后停留在上次滚动位置
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  // 打开详情抽屉时锁定背景滚动，并支持 Esc 键关闭，让点击跳转的落点更明确
  useEffect(() => {
    if (!selectedLocationId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedLocationId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedLocationId]);

  const rankings = useMemo(() => {
    const scoreIndex = Math.max(0, nightOffset(snapshotStartNight, selectedNight));
    return rankingPool
      .map((location) => {
        const forecast = forecasts.find((item) => item.locationId === location.id);
        const leadIndex = nextNightKeys(14).indexOf(selectedNight);
        return {
          location,
          forecast,
          evaluation: forecast ? evaluateNight(forecast, location, selectedNight, leadIndex) : null,
          sharedScore: activeObservationSnapshot?.sites?.[location.id]?.[scoreIndex] ?? null,
        };
      })
      .sort((a, b) => rankValue(b, mode) - rankValue(a, mode));
  }, [activeObservationSnapshot, forecasts, mode, rankingPool, selectedNight, snapshotStartNight]);

  const best = rankings[0];
  const detail = selectedLocationId ? rankings.find((item) => item.location.id === selectedLocationId) : null;
  const featured = detail ?? best;
  // A deep-linked point is the session source of truth. A ranked detail only
  // takes over when the planner was opened without a point in the URL.
  // The currently opened detail is the latest explicit user choice. The
  // incoming bridge location is only a fallback until the user picks another
  // place inside the planner.

  const handleSelectNight = useCallback((night) => {
    setSelectedNight(night);
    selectSharedNight(night);
  }, [selectSharedNight]);

  const handleReturnTonight = useCallback(() => {
    setRangeStartNight(tonightNight);
    setDays(7);
    setSelectedNight(tonightNight);
    selectSharedNight(tonightNight);
  }, [selectSharedNight, tonightNight]);

  const handleOpenDetail = useCallback((locationId) => {
    setSelectedLocationId(locationId);
    const location = locations.find((item) => item.id === locationId);
    if (location) void selectSharedLocation(location);
  }, [locations, selectSharedLocation]);

  function addLocation(form) {
    const nextLocation = createLocation(form);
    if (locations.some((location) => sameLocationIdentity(location, nextLocation))) {
      setError("该坐标已在候选列表中；未重复保存同一观测点。");
      return;
    }
    addCandidate(nextLocation);
    const next = dedupeLocationIdentities([...customLocations, nextLocation]);
    setCustomLocations(next);
    writeCustomLocations(next);
    setError("新点位已保存到本机；点击刷新获取天气数据。");
  }

  function removeCustomLocation(id) {
    const next = customLocations.filter((item) => item.id !== id);
    setCustomLocations(next);
    writeCustomLocations(next);
  }

  return (
    <div className="planner-root app-shell">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <ProductHeader
        mark={<Telescope strokeWidth={2.1} />}
        eyebrow="逐星"
        title="观星计划"
      >
        <nav className="desktop-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
          ))}
        </nav>
        <button className="refresh-button" type="button" onClick={() => refresh()} disabled={loading}>
          <ArrowsClockwise className={loading ? "spin" : ""} />
          <span>{loading ? "更新中" : "刷新"}</span>
        </button>
      </ProductHeader>

      <main className="main-content" id="main-content" tabIndex="-1">
        <section className="control-strip" aria-label="预测范围与推荐设置">
          <div className="segmented" aria-label="预测天数">
            {[1, 3, 5, 7].map((value) => (
              <button key={value} type="button" aria-pressed={days === value} className={days === value ? "active" : ""} onClick={() => changeDays(value)}>{value} 天</button>
            ))}
          </div>
          <div className="segmented nearby-switch" aria-label="附近观星点推荐范围">
            <span className="segmented-caption"><Sparkle />附近推荐</span>
            {NEARBY_RADIUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={nearbyRadiusKm === option.value}
                className={nearbyRadiusKm === option.value ? "active" : ""}
                onClick={() => setNearbyRadiusKm(option.value)}
              >{option.label}</button>
            ))}
          </div>
          <div className={`freshness ${stale || displayedSnapshotStatus === "degraded" ? "stale" : ""}`} role="status" aria-live="polite">
            <span className="freshness-dot" />{relativeFreshness(savedAt)}{stale || displayedSnapshotStatus === "degraded" ? " · 已降级" : displayedSnapshotStatus === "loading" ? " · 评分读取中" : ""}
          </div>
        </section>

        {error && <StatusBanner message={error} stale={stale} />}
        {view !== "map" && locations.length > 0 && !forecasts.length && loading ? <LoadingState /> : null}
        {view !== "map" && view !== "locations" && (!locations.length || !forecasts.length) && !loading ? <EmptyState hasLocations={locations.length > 0} onRefresh={() => refresh()} /> : null}

        {locations.length > 0 && forecasts.length > 0 && view === "dashboard" && (
          <Dashboard
            best={featured}
            rankings={rankings}
            nightKeys={nightKeys}
            selectedNight={selectedNight}
            onSelectNight={handleSelectNight}
            mode={mode}
            onOpenDetail={handleOpenDetail}
            isSpecifiedNight={isSpecifiedNight}
            onReturnTonight={handleReturnTonight}
            isLinkedLocation={Boolean(detail)}
            observationSnapshot={activeObservationSnapshot}
            snapshotStartNight={snapshotStartNight}
            nearby={{ enabled: nearbyRadiusKm > 0, radiusKm: nearbyRadiusKm, anchorName: nearbyAnchor?.name ?? "", count: recommendedLocations.length, fallbackCount: recommendedLocations.filter((item) => item.nearbyFallback).length }}
          />
        )}
        {locations.length > 0 && forecasts.length > 0 && view === "matrix" && (
          <MatrixView
            locations={locations}
            forecasts={forecasts}
            nightKeys={nightKeys}
            mode={mode}
            observationSnapshot={activeObservationSnapshot}
            snapshotStartNight={snapshotStartNight}
            onSelect={(locationId, night) => {
              handleSelectNight(night);
              setSelectedLocationId(locationId);
            }}
          />
        )}
        {view === "map" && (
          <ObservationMap
            locations={locations}
            forecasts={forecasts}
            days={days}
            nightKeys={nightKeys}
            selectedNight={selectedNight}
            onSelectNight={handleSelectNight}
            onSave={addLocation}
          />
        )}
        {view === "locations" && (
          <LocationsView locations={locations} customLocations={customLocations} onAdd={addLocation} onRemove={removeCustomLocation} />
        )}
      </main>

      <footer className="site-footer">
        <span>天气数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></span>
        <span>天文计算：Astronomy Engine</span>
        <span>预测用于摄影规划，不替代现场安全判断</span>
      </footer>

      <nav className="mobile-nav" aria-label="移动导航">
        {NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
      </nav>

      {detail && (
        <DetailDrawer
          key={detail.location.id}
          item={detail}
          nightKey={selectedNight}
          savedAt={savedAt}
          stale={stale}
          refreshing={loading}
          onRefresh={() => refresh()}
          onSelectNight={handleSelectNight}
          onSelectForecastTime={(time) => setSharedCloud({
            activeForecastTime: time,
            overlayMode: "forecast-cloud",
            playing: false,
          })}
          onClose={() => setSelectedLocationId(null)}
        />
      )}
    </div>
  );
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return <button type="button" aria-current={active ? "page" : undefined} className={active ? "active" : ""} onClick={onClick}><Icon aria-hidden="true" strokeWidth={active ? 2.4 : 1.7} /><span>{item.label}</span></button>;
}

function StatusBanner({ message, stale }) {
  return <div className={`status-banner ${stale ? "warning" : "info"}`} role="status" aria-live="polite"><Warning aria-hidden="true" strokeWidth={2.4} /><span>{message}</span></div>;
}

function LoadingState() {
  return <section className="loading-state" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><h2>正在读取候选地点的天气</h2><p>首次加载会计算今晚及未来夜晚的云量、降水和观星窗口。</p></section>;
}

function EmptyState({ hasLocations, onRefresh }) {
  return <section className="empty-state"><Cloud size={36} /><h2>{hasLocations ? "还没有天气数据" : "还没有候选观测点"}</h2><p>{hasLocations ? "连接网络后刷新，页面会保留最近一次成功数据。" : "请先从今夜观测或暗夜选址加入地点。观星计划会比较今晚及未来 3、5、7 个观测夜，并生成地点排行。"}</p>{!hasLocations && <Link className="primary-button" href="/">回到今夜观测</Link>}<button className="secondary-button" type="button" onClick={onRefresh}>重新读取</button></section>;
}

function Dashboard({ best, rankings, nightKeys, selectedNight, onSelectNight, mode, onOpenDetail, isSpecifiedNight, onReturnTonight, isLinkedLocation, observationSnapshot, snapshotStartNight, nearby }) {
  const evaluation = best?.evaluation;
  const sharedScore = best?.sharedScore;
  const meta = recommendationMeta(sharedScore, evaluation);
  const displayScore = sharedScore?.score ?? (mode === "cloud" ? evaluation?.cloudSeaPotential : evaluation?.score);
  return (
    <>
      <section className="hero-grid">
        <article className="hero-card">
          <div className="hero-header">
            <span className="section-kicker">{formatNightLabel(selectedNight)} · {mode === "star" ? "星空最佳" : "云海潜力"}</span>
            {isSpecifiedNight && <button className="specified-night-button" type="button" onClick={onReturnTonight}>回到今晚</button>}
            <ForecastThemeSwitch />
            <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
          </div>
          <div className="hero-location">
            <div>
              <p className="hero-overline">{isLinkedLocation ? "指定观测点" : best?.location.source === "附近推荐" ? "附近推荐机位" : "综合最优机位"}</p>
              <h2>{best?.location.name ?? "计算中"}</h2>
              <p className="coordinate"><MapPin />{formatSiteElevation(best?.location.elevation)} · {best?.location.latitude.toFixed(4)}, {best?.location.longitude.toFixed(4)}{best?.location.source === "附近推荐" && best?.location.distanceKm != null ? ` · 距离约 ${best.location.distanceKm} km` : ""}</p>
            </div>
            <ScoreRing value={displayScore} label={mode === "cloud" ? "云海指数" : "星空分"} />
          </div>
          <div className="window-callout">
            <div className="window-icon"><Binoculars /></div>
            <div><span>最佳连续窗口</span><strong>{evaluation?.windowLabel ?? "暂无数据"}</strong></div>
          </div>
          <p className="hero-reason">{evaluation?.reason}</p>
          <div className="hero-metrics">
            <Metric icon={Moon} label="月面照度" value={formatNullable(evaluation?.moonIllumination, "%", (value) => Math.round(value * 100))} />
            <Metric icon={Sparkle} label="暗夜时长" value={formatNullable(evaluation?.darkHours, "h")} />
            <Metric icon={Compass} label="银河最高" value={formatNullable(evaluation?.galacticMax, "°")} />
            <Metric icon={Info} label="置信度" value={evaluation?.confidence.level ?? "—"} />
          </div>
          <button className="detail-cta" type="button" onClick={() => best && onOpenDetail(best.location.id)}>查看逐小时详情<CaretRight /></button>
        </article>

        <article className="briefing-card">
          <div className="card-heading"><div><span className="section-kicker">决策摘要</span><h3>今晚判断依据</h3></div><ListBullets /></div>
          <DecisionItem tone={evaluation?.status === "go" ? "good" : "warn"} title={evaluation?.window.length >= 2 ? "连续窗口成立" : "连续窗口不足"} text={evaluation?.windowLabel} />
          <DecisionItem tone={(sharedScore?.blockers?.length ?? evaluation?.blockers?.length ?? 0) ? "bad" : "good"} title={(sharedScore?.blockers?.length ?? evaluation?.blockers?.length ?? 0) ? "存在天气门禁" : "无主要安全门禁"} text={sharedScore?.blockers?.join("、") || evaluation?.blockers?.join("、") || "未触发雷暴、强降水、低能见度或大阵风门禁"} />
          <DecisionItem tone={evaluation?.confidence.kind === "trend" ? "warn" : "info"} title={`置信度：${evaluation?.confidence.level ?? "—"}`} text={evaluation?.confidence.reason ?? "等待数据"} />
          <p className="brief-note"><Info />14 天用于看趋势；最终出发前请在 72 小时内再次刷新，并核对道路和现场云况。</p>
        </article>
      </section>

      <NightRail nightKeys={nightKeys} selectedNight={selectedNight} onSelect={onSelectNight} rankings={rankings} mode={mode} observationSnapshot={observationSnapshot} snapshotStartNight={snapshotStartNight} />

      <section className="rank-section">
        <div className="section-heading-row">
          <div>
            <span className="section-kicker">地点排名</span>
            <h2>{mode === "star" ? "点位星空排名" : "点位云海潜力"}</h2>
            {nearby?.enabled && nearby.count > 0 && (
              <p className="nearby-hint">已并入 {nearby.anchorName} 周边 {nearby.radiusKm} km 内的 {nearby.count - (nearby.fallbackCount ?? 0)} 个点位{nearby.fallbackCount ? `，另补最近 ${nearby.fallbackCount} 个` : ""}（仅作参考，不写入本机列表）</p>
            )}
          </div>
          <span className="count-label">{rankings.length} 个点位</span>
        </div>
        <div className="ranking-list">
          {rankings.map((item, index) => <RankCard key={item.location.id} item={item} rank={index + 1} mode={mode} onOpen={() => onOpenDetail(item.location.id)} />)}
        </div>
      </section>
    </>
  );
}

function ScoreRing({ value = 0, label }) {
  const safe = Number.isFinite(value) ? value : 0;
  return <div className="score-ring" style={{ "--score": `${safe * 3.6}deg` }}><div><strong>{safe}</strong><span>{label}</span></div></div>;
}

function Metric({ icon: Icon, label, value }) {
  return <div className="metric"><Icon /><span>{label}</span><strong>{value}</strong></div>;
}

function formatNullable(value, suffix = "", transform = (item) => item) {
  return value == null || !Number.isFinite(value) ? "—" : `${transform(value)}${suffix}`;
}

// 参考点位库中约半数海拔未核验；显示层绝不能把未知伪装成 0 m。
function formatSiteElevation(value) {
  return value == null || !Number.isFinite(value) ? "海拔待核" : `${Math.round(value)} m`;
}

function DecisionItem({ tone, title, text }) {
  return <div className={`decision-item ${tone}`}><span className="decision-dot" /><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function NightRail({ nightKeys, selectedNight, onSelect, rankings, mode, observationSnapshot, snapshotStartNight }) {
  return (
    <section className="night-section">
      <div className="section-heading-row compact"><div><span className="section-kicker">未来观测夜</span><h2>观测夜</h2></div><CalendarBlank /></div>
      <div className="night-rail">
        {nightKeys.map((night, index) => {
          const sharedBest = rankings
            .map((item) => ({ item, score: observationSnapshot?.sites?.[item.location.id]?.[Math.max(0, nightOffset(snapshotStartNight, night))] ?? null }))
            .filter((item) => item.score)
            .sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1))[0]?.score ?? null;
          const best = rankings
            .map((item) => item.forecast ? evaluateNight(item.forecast, item.location, night, index) : null)
            .filter(Boolean)
            .sort((a, b) => (mode === "cloud" ? b.cloudSeaPotential - a.cloudSeaPotential : b.score - a.score))[0];
          const meta = sharedBest ? recommendationMeta(sharedBest, null) : statusMeta(best?.status);
          const displayValue = sharedBest
            ? mode === "cloud"
              ? sharedBest.cloud == null ? null : Math.round(100 - sharedBest.cloud)
              : sharedBest.score
            : mode === "cloud" ? best?.cloudSeaPotential : best?.score;
          return (
            <button key={night} type="button" aria-pressed={selectedNight === night} className={selectedNight === night ? "active" : ""} onClick={() => onSelect(night)}>
              <span>{formatNightLabel(night, true)}</span>
              <strong>{displayValue ?? "—"}</strong>
              <small className={meta.tone}>{index >= 7 ? "趋势" : meta.label}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RankCard({ item, rank, mode, onOpen }) {
  const evaluation = item.evaluation;
  const sharedScore = item.sharedScore;
  const meta = recommendationMeta(sharedScore, evaluation);
  const score = sharedScore?.score ?? (mode === "cloud" ? evaluation?.cloudSeaPotential : evaluation?.score);
  const bestHour = evaluation?.window[0] ?? [...(evaluation?.hours ?? [])].sort((a, b) => b.score - a.score)[0];
  const cloud = sharedScore?.cloud ?? (bestHour?.cloudCover == null ? null : Math.round(bestHour.cloudCover));
  const bestWindow = sharedScore?.bestWindow ?? evaluation?.windowLabel;
  return (
    <button className="rank-card" type="button" onClick={onOpen}>
      <span className={`rank-number ${rank <= 3 ? "top" : ""}`}>{String(rank).padStart(2, "0")}</span>
      <div className="rank-main">
        <div className="rank-title"><div><h3>{item.location.name}{item.location.source === "附近推荐" && <span className="recommend-chip">{item.location.nearbyFallback ? "最近补充" : "附近推荐"} · {item.location.distanceKm} km</span>}</h3><p>{formatSiteElevation(item.location.elevation)} · {evaluation?.confidence.level ?? "—"}置信度</p></div><span className={`status-pill ${meta.tone}`}>{meta.label}</span></div>
        <div className="rank-stats">
          <span><Cloud />云量 {cloud == null ? "—" : `${cloud}%`}</span>
          <span><CloudRain />降水 {formatNullable(bestHour?.precipitationProbability, "%", Math.round)}</span>
          <span><Wind />阵风 {formatNullable(bestHour?.windGust, " m/s", Math.round)}</span>
          <span><Moon />照度 {formatNullable(evaluation?.moonIllumination, "%", (value) => Math.round(value * 100))}</span>
        </div>
        <p className="rank-window"><Binoculars />{bestWindow ?? "暂无连续窗口"}</p>
      </div>
      <div className="rank-score"><strong>{score ?? "—"}</strong><span>{sharedScore ? "综合" : mode === "cloud" ? "云海" : "星空"}</span><CaretRight /></div>
    </button>
  );
}

function MatrixView({ locations, forecasts, nightKeys, mode, onSelect, observationSnapshot, snapshotStartNight }) {
  const matrix = useMemo(() => locations.map((location) => {
    const forecast = forecasts.find((item) => item.locationId === location.id);
    return {
      location,
      values: nightKeys.map((night, index) => {
        const sharedScore = observationSnapshot?.sites?.[location.id]?.[Math.max(0, nightOffset(snapshotStartNight, night))] ?? null;
        return { evaluation: forecast ? evaluateNight(forecast, location, night, index) : null, sharedScore };
      }),
    };
  }), [forecasts, locations, nightKeys, observationSnapshot, snapshotStartNight]);
  return (
    <section className="matrix-section">
      <div className="section-heading-row"><div><span className="section-kicker">核心窗口</span><h2>{mode === "star" ? "星空核心窗口" : "云海潜力矩阵"}</h2><p>单元格显示{mode === "star" ? "优质连续小时 / 星空分" : "云海潜力指数"}；点击查看详情。</p></div></div>
      <div className="matrix-wrap">
        <table>
          <thead><tr><th>点位</th>{nightKeys.map((night) => <th key={night}>{formatNightLabel(night, true)}</th>)}</tr></thead>
          <tbody>{matrix.map((row) => <tr key={row.location.id}><th>{row.location.name}<small>{formatSiteElevation(row.location.elevation)}</small></th>{row.values.map((value, index) => {
            const sharedScore = value?.sharedScore;
            const evaluation = value?.evaluation;
            const meta = sharedScore ? recommendationMeta(sharedScore, null) : statusMeta(evaluation?.status);
            const score = sharedScore?.score ?? (mode === "star" ? evaluation?.score : evaluation?.cloudSeaPotential);
            const cloudPotential = sharedScore?.cloud == null ? evaluation?.cloudSeaPotential : Math.round(100 - sharedScore.cloud);
            const windowLength = sharedScore?.bestWindow?.match(/(\d+)h/)?.[1] ?? evaluation?.window?.length ?? 0;
            const cellValue = mode === "star" ? `${windowLength} 小时，${score ?? "无"} 分` : `${cloudPotential ?? "无"} 分`;
            return <td key={nightKeys[index]}><button type="button" aria-label={`${row.location.name} ${formatNightLabel(nightKeys[index], true)} ${cellValue}`} className={`matrix-cell ${meta.tone}`} onClick={() => onSelect(row.location.id, nightKeys[index])}>{mode === "star" ? <><strong>{windowLength}h</strong><span>/ {score ?? "—"}</span></> : <strong>{cloudPotential ?? "—"}</strong>}</button></td>;
          })}</tr>)}</tbody>
        </table>
      </div>
      <div className="legend"><span className="good">推荐</span><span className="warn">候选</span><span className="bad">不建议</span><span className="muted">趋势/无数据</span></div>
    </section>
  );
}

function LocationsView({ locations, customLocations, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", elevation: "" });
  const formRef = useDialogFocus(showForm, () => setShowForm(false));
  function submit(event) {
    event.preventDefault();
    if (!form.name || !Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude)) || !Number.isFinite(Number(form.elevation))) return;
    onAdd(form);
    setForm({ name: "", latitude: "", longitude: "", elevation: "" });
    setShowForm(false);
  }
  return (
    <section className="locations-section">
      <div className="section-heading-row"><div><span className="section-kicker">观测点管理</span><h2>点位管理</h2><p>天气查询统一使用 WGS84 坐标；用户海拔不会被模型静默覆盖。</p></div><button className="primary-button" type="button" onClick={() => setShowForm(true)}><Plus />新增点位</button></div>
      <div className="location-table-wrap"><table className="location-table"><thead><tr><th>点位</th><th>纬度</th><th>经度</th><th>海拔(m)</th><th>来源</th><th /></tr></thead><tbody>{locations.map((location) => <tr key={location.id}><td><MapPin />{location.name}</td><td>{location.latitude.toFixed(4)}</td><td>{location.longitude.toFixed(4)}</td><td>{location.elevation == null ? "—" : Math.round(location.elevation)}</td><td>{location.source}</td><td>{customLocations.some((item) => item.id === location.id) && <button className="icon-button danger" type="button" onClick={() => onRemove(location.id)} aria-label={`删除 ${location.name}`}><X /></button>}</td></tr>)}</tbody></table></div>
      {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form ref={formRef} className="location-form" role="dialog" aria-modal="true" aria-labelledby="location-form-title" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="form-header"><div><span className="section-kicker">新增地点</span><h3 id="location-form-title">新增观测点</h3></div><button type="button" className="icon-button" aria-label="关闭表单" onClick={() => setShowForm(false)}><X /></button></div><label>点位名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：东白山" required /></label><div className="form-grid"><label>纬度<input type="number" step="0.0001" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="29.5000" required /></label><label>经度<input type="number" step="0.0001" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="120.3000" required /></label></div><label>用户海拔（米）<input type="number" step="0.1" value={form.elevation} onChange={(event) => setForm({ ...form, elevation: event.target.value })} placeholder="1000" required /></label><p className="form-note"><Info />保存后点击刷新获取 14 天天气。自定义点位只保存在本机浏览器。</p><button className="primary-button wide" type="submit"><CheckCircle />保存点位</button></form></div>}
    </section>
  );
}

function DetailDrawer({
  item,
  nightKey,
  savedAt,
  stale,
  refreshing,
  onRefresh,
  onSelectNight,
  onSelectForecastTime,
  onClose,
}) {
  const { location, evaluation, forecast } = item;
  // 库里未核验海拔的点位用模型地形高程兜底计算剖面，展示层仍如实标注。
  const siteElevation = location.elevation ?? forecast?.metadata?.modelElevation ?? 0;
  const elevationEstimated = location.elevation == null && forecast?.metadata?.modelElevation != null;
  const [pressure, setPressure] = useState(null);
  const [pressureError, setPressureError] = useState("");
  const [pressureLoading, setPressureLoading] = useState(true);
  const [activeHour, setActiveHour] = useState(evaluation?.window[0]?.time ?? evaluation?.hours?.[0]?.time);
  const [detailDays, setDetailDays] = useState(1);
  const [detailNightKey, setDetailNightKey] = useState(nightKey);
  const [rangeStartNight] = useState(nightKey);
  const [drawerWidth, setDrawerWidth] = useState(PLANNER_DRAWER_DEFAULT_WIDTH);
  const drawerDragRef = useRef(null);
  const drawerDragMovedRef = useRef(false);
  const lastDrawerDragEndRef = useRef(0);
  const drawerRef = useDialogFocus(true, onClose);

  const availableDetailNights = useMemo(() => detailNightKeys(rangeStartNight, detailDays), [detailDays, rangeStartNight]);
  const detailEvaluations = useMemo(() => availableDetailNights.map((key) => {
    const source = forecast ? evaluateNight(
      forecast,
      location,
      key,
      Math.max(0, nextNightKeys(14).indexOf(key)),
    ) : key === nightKey ? evaluation : null;
    return { nightKey: key, evaluation: source };
  }), [availableDetailNights, evaluation, forecast, location, nightKey]);
  const activeDetailNight = availableDetailNights.includes(detailNightKey) ? detailNightKey : rangeStartNight;
  const activeEvaluation = detailEvaluations.find((item) => item.nightKey === activeDetailNight)?.evaluation ?? evaluation;
  const activeDetailHour = activeEvaluation?.hours?.some((hour) => hour.time === activeHour)
    ? activeHour
    : activeEvaluation?.window[0]?.time ?? activeEvaluation?.hours?.[0]?.time;
  const pressureModel = forecast?.metadata?.model ?? "best_match";
  const forecastUpdatedAt = forecast?.metadata?.fetchedAt ?? savedAt;

  const selectDetailNight = useCallback((key, nextEvaluation) => {
    const nextHour = nextEvaluation?.window?.[0]?.time ?? nextEvaluation?.hours?.[0]?.time;
    setDetailNightKey(key);
    setActiveHour(nextHour);
    onSelectNight?.(key);
    onSelectForecastTime?.(nextHour ?? null);
  }, [onSelectForecastTime, onSelectNight]);

  const selectDetailHour = useCallback((time) => {
    setActiveHour(time);
    if (time) onSelectForecastTime?.(time);
  }, [onSelectForecastTime]);

  const changeDetailRange = useCallback((days) => {
    const nextNights = detailNightKeys(rangeStartNight, days);
    setDetailDays(days);
    if (!nextNights.includes(activeDetailNight)) {
      const nextEvaluation = forecast
        ? evaluateNight(forecast, location, rangeStartNight, Math.max(0, nextNightKeys(14).indexOf(rangeStartNight)))
        : evaluation;
      selectDetailNight(rangeStartNight, nextEvaluation);
    }
  }, [activeDetailNight, evaluation, forecast, location, rangeStartNight, selectDetailNight]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = readPlannerDrawerWidth();
      if (saved !== null) setDrawerWidth(saved);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const persistDrawerWidth = useCallback((value) => {
    const next = clampPlannerDrawerWidth(value);
    setDrawerWidth(next);
    try {
      localStorage.setItem(PLANNER_DRAWER_WIDTH_KEY, String(next));
    } catch {
      // Private browsing or quota errors do not block the current drawer.
    }
  }, []);

  const finishDrawerDrag = useCallback((event) => {
    const drag = drawerDragRef.current;
    if (!drag) return;
    drawerDragRef.current = null;
    lastDrawerDragEndRef.current = Date.now();
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
    persistDrawerWidth(drag.liveWidth);
  }, [persistDrawerWidth]);

  const onDrawerResizePointerDown = useCallback((event) => {
    if (typeof window !== "undefined" && window.innerWidth <= 840) return;
    if (event.button !== 0) return;
    event.preventDefault();
    const currentWidth = drawerRef.current?.getBoundingClientRect().width ?? drawerWidth;
    if (Date.now() - lastDrawerDragEndRef.current > DRAWER_DRAG_RESET_GUARD_MS) {
      drawerDragMovedRef.current = false;
    }
    drawerDragRef.current = { startX: event.clientX, startWidth: currentWidth, liveWidth: currentWidth };
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, [drawerRef, drawerWidth]);

  const onDrawerResizePointerMove = useCallback((event) => {
    const drag = drawerDragRef.current;
    if (!drag) return;
    event.preventDefault();
    drawerDragMovedRef.current = true;
    // The drawer is right anchored: moving its left rail left makes it wider.
    drag.liveWidth = clampPlannerDrawerWidth(drag.startWidth + drag.startX - event.clientX);
    setDrawerWidth(drag.liveWidth);
  }, []);

  const resetDrawerWidth = useCallback(() => {
    if (drawerDragMovedRef.current || Date.now() - lastDrawerDragEndRef.current < DRAWER_DRAG_RESET_GUARD_MS) return;
    drawerDragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    setDrawerWidth(PLANNER_DRAWER_DEFAULT_WIDTH);
    try {
      localStorage.removeItem(PLANNER_DRAWER_WIDTH_KEY);
    } catch {
      // Ignore private browsing/localStorage failures.
    }
  }, []);

  const onDrawerResizeKeyDown = useCallback((event) => {
    if (typeof window !== "undefined" && window.innerWidth <= 840) return;
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      persistDrawerWidth(drawerWidth + (event.key === "ArrowLeft" ? step : -step));
    } else if (event.key === "Home") {
      event.preventDefault();
      persistDrawerWidth(PLANNER_DRAWER_MIN_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      persistDrawerWidth(PLANNER_DRAWER_MAX_WIDTH);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      resetDrawerWidth();
    }
  }, [drawerWidth, persistDrawerWidth, resetDrawerWidth]);

  useEffect(() => () => {
    drawerDragRef.current = null;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPressureForecast(location, 14, controller.signal, pressureModel)
      .then(setPressure)
      .catch(() => setPressureError("垂直云层暂时不可用；地面天气与天文判断仍可查看。"))
      .finally(() => setPressureLoading(false));
    return () => controller.abort();
  }, [location, pressureModel]);

  const profile = useMemo(() => pressure?.profiles?.[activeDetailHour] ?? [], [pressure, activeDetailHour]);
  const layers = useMemo(
    () => pressure ? deriveCloudLayers(profile, pressure.modelElevation, siteElevation) : [],
    [pressure, profile, siteElevation],
  );
  const weatherOption = useMemo(() => buildWeatherChart(activeEvaluation?.hours ?? []), [activeEvaluation]);
  const astroOption = useMemo(() => buildAstroChart(activeEvaluation?.hours ?? []), [activeEvaluation]);
  const profileOption = useMemo(() => buildProfileChart(profile, siteElevation), [profile, siteElevation]);
  const trendOption = useMemo(() => buildNightTrendChart(detailEvaluations), [detailEvaluations]);
  const trendChartKey = `${detailDays}-${availableDetailNights.join("-")}-${forecastUpdatedAt ?? "cache"}`;
  const activeChartKey = `${activeDetailNight}-${activeDetailHour ?? "empty"}`;

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside ref={drawerRef} className="detail-drawer" style={{ "--planner-drawer-width": `${drawerWidth}px` }} role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()} aria-labelledby="detail-drawer-title">
        <div
          className="detail-drawer-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="拖动调整详情面板宽度"
          aria-valuemin={PLANNER_DRAWER_MIN_WIDTH}
          aria-valuemax={PLANNER_DRAWER_MAX_WIDTH}
          aria-valuenow={drawerWidth}
          aria-valuetext={`${drawerWidth}px；拖动左边缘或使用左右方向键调整，双击恢复默认宽度`}
          tabIndex={0}
          data-testid="planner-detail-resizer"
          onPointerDown={onDrawerResizePointerDown}
          onPointerMove={onDrawerResizePointerMove}
          onPointerUp={finishDrawerDrag}
          onPointerCancel={finishDrawerDrag}
          onLostPointerCapture={finishDrawerDrag}
          onKeyDown={onDrawerResizeKeyDown}
          onDoubleClick={resetDrawerWidth}
        />
        <div className="drawer-header"><div><span className="section-kicker">地点详情 · {formatNightLabel(activeDetailNight)}</span><h2 id="detail-drawer-title">{location.name}</h2><p>{formatSiteElevation(location.elevation)} · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p></div><button className="icon-button" type="button" aria-label="关闭详情" onClick={onClose}><X /></button></div>
        <section className="detail-range-panel" aria-label="地点详情预报范围" data-active-night={activeDetailNight}>
          <div className="detail-range-heading">
            <div><span className="section-kicker">今夜观测地点会话 / 观星计划</span><strong>未来多夜趋势与单夜下钻</strong></div>
            <div className="detail-range-source">
              <span><CheckCircle aria-hidden="true" />状态已同步</span>
              <small>{forecast?.metadata?.model?.toUpperCase() ?? "天气模型"} · {relativeFreshness(forecastUpdatedAt)}{stale ? " · 已过期" : ""}</small>
              <button type="button" onClick={onRefresh} disabled={refreshing}><ArrowsClockwise className={refreshing ? "spin" : ""} />{refreshing ? "更新中" : "刷新数据"}</button>
            </div>
          </div>
          <div className="detail-range-tabs" role="group" aria-label="地点详情时间范围">
            {DETAIL_RANGE_OPTIONS.map((option) => <button key={option.value} type="button" aria-pressed={detailDays === option.value} className={detailDays === option.value ? "active" : ""} onClick={() => changeDetailRange(option.value)}>{option.label}<small>{option.hint}</small></button>)}
          </div>
          <p className="detail-range-feedback" aria-live="polite">已加载未来 {detailDays} 夜趋势；当前下钻：{formatNightLabel(activeDetailNight, true)}</p>
          <AccessibleChart
            option={trendOption}
            height={236}
            chartKey={trendChartKey}
            testId="detail-range-trend"
            dataNightCount={detailEvaluations.length}
            label={`${detailDays}夜趋势图：星空分、平均总云量和连续观测窗口`}
          />
          <div className="detail-night-strip" role="group" aria-label={`${detailDays}天预报夜次`}>
            {detailEvaluations.map(({ nightKey: key, evaluation: itemEvaluation }, index) => {
              const meta = statusMeta(itemEvaluation?.status);
              const averageCloud = averageNumeric(itemEvaluation?.hours, "cloudCover");
              return <button key={key} type="button" data-night-key={key} className={key === activeDetailNight ? "active" : ""} aria-pressed={key === activeDetailNight} onClick={() => selectDetailNight(key, itemEvaluation)}><small>第 {index + 1} 夜</small><strong>{formatNightLabel(key, true)}</strong><span>{itemEvaluation ? `${itemEvaluation.score} 分 · 云量 ${averageCloud ?? "—"}% · 窗口 ${itemEvaluation.window.length}h` : "暂无数据"}</span><em className={meta.tone}>{itemEvaluation ? meta.label : "无数据"}</em></button>;
            })}
          </div>
          <p className="detail-range-note">趋势图会随“今日 / 3 天 / 5 天 / 7 天”立即改变；星空分越高越适合观测，平均总云量越低越好，窗口表示连续可用小时。点击夜次或小时后，今夜观测地图会恢复同一地点、模型与时次。</p>
        </section>
        <div className="detail-summary"><ScoreRing value={activeEvaluation?.score} label="星空分" /><div><span className={`status-pill ${statusMeta(activeEvaluation?.status).tone}`}>{statusMeta(activeEvaluation?.status).label}</span><h3>{activeEvaluation?.windowLabel}</h3><p>{activeEvaluation?.reason}</p></div></div>
        <div className="detail-metrics"><Metric icon={Cloud} label="云海潜力" value={activeEvaluation?.cloudSeaPotential ?? "—"} /><Metric icon={Moon} label="月面照度" value={formatNullable(activeEvaluation?.moonIllumination, "%", (value) => Math.round(value * 100))} /><Metric icon={Sparkle} label="天文暗夜" value={formatNullable(activeEvaluation?.darkHours, "h")} /><Metric icon={Compass} label="银河最高" value={formatNullable(activeEvaluation?.galacticMax, "°")} /></div>

        <DetailSection title="逐小时天气" subtitle={`${formatNightLabel(activeDetailNight, true)} · 云量、降水与风`} icon={Cloud}>
          <AccessibleChart option={weatherOption} height={260} chartKey={`weather-${activeChartKey}`} testId="detail-weather-chart" label={`${formatNightLabel(activeDetailNight, true)}逐小时天气图：总云量、低云量、降水概率和阵风`} />
          <div className="hour-chips">{activeEvaluation?.hours.map((hour) => <button key={hour.time} type="button" data-time={hour.time} aria-pressed={activeDetailHour === hour.time} aria-label={`${formatHour(hour.time)}，评分 ${hour.score}`} className={activeDetailHour === hour.time ? "active" : ""} onClick={() => selectDetailHour(hour.time)}><span>{formatHour(hour.time)}</span><strong>{hour.score}</strong></button>)}</div>
        </DetailSection>
        <DetailSection title="天文轨迹" subtitle={`${formatNightLabel(activeDetailNight, true)} · 太阳、月亮与银河核心高度`} icon={Moon}><AccessibleChart option={astroOption} height={230} chartKey={`astro-${activeChartKey}`} label={`${formatNightLabel(activeDetailNight, true)}天文轨迹图：太阳、月亮与银河核心高度`} /></DetailSection>
        <DetailSection title="低云海拔评估" subtitle="实验性气压层推导，不是山顶实测" icon={Mountains}>
          {pressureLoading && <div className="inline-loading"><span className="loader small" />读取垂直云层…</div>}
          {pressureError && <p className="inline-error"><Warning />{pressureError}</p>}
          {pressure && <><div className="profile-meta"><span>模型地形：{Math.round(pressure.modelElevation)} m</span><span>{elevationEstimated ? `海拔按模型地形 ${Math.round(siteElevation)} m 估算` : `点位海拔：${Math.round(siteElevation)} m`}</span><span>时次：{formatHour(activeDetailHour)}</span></div><AccessibleChart option={profileOption} height={250} chartKey={`profile-${activeChartKey}`} label="低云垂直剖面图：云量与海拔关系" />{layers.length ? <div className="cloud-layer-list">{layers.map((layer, index) => <div className="cloud-layer" key={`${layer.baseMsl}-${index}`}><Cloud strokeWidth={2.4} /><div><strong>{layer.baseMsl}–{layer.topMsl} m MSL</strong><span>距模型地面 {layer.baseAgl}–{layer.topAgl} m AGL · {layer.confidence}置信度</span></div><span className={`relation ${layer.relation === "云上" ? "good" : layer.relation === "云中" ? "bad" : "warn"}`}>{layer.relation}</span></div>)}</div> : <p className="no-layer">该时次未识别到可靠连续云层。</p>}</>}
        </DetailSection>
        <div className="method-note"><Info /><p><strong>方法边界</strong> 云底/云顶由数值模型气压层推导，已过滤模型地表以下层并取整到 50 m。复杂山地仍需结合现场云图、能见度与周边谷地情况。</p></div>
        <HourlyForecastMatrix nightKey={activeDetailNight} hours={activeEvaluation?.hours ?? []} selectedTime={activeDetailHour} onSelectTime={selectDetailHour} title="单夜十小时矩阵" />
      </aside>
    </div>
  );
}

function DetailSection({ title, subtitle, icon: Icon, children }) {
  return <section className="detail-section"><div className="detail-section-heading"><div><Icon /><div><h3>{title}</h3><p>{subtitle}</p></div></div></div>{children}</section>;
}

function AccessibleChart({ option, height, label, chartKey, testId, dataNightCount }) {
  return (
    <div className="chart-frame" role="img" aria-label={label} data-chart-key={chartKey} data-testid={testId} data-night-count={dataNightCount}>
      <Suspense fallback={<div className="chart-loading" role="status"><span className="loader small" aria-hidden="true" />正在加载图表…</div>}>
        <ReactECharts key={chartKey} option={option} style={{ height }} notMerge lazyUpdate={false} />
      </Suspense>
    </div>
  );
}

function averageNumeric(hours, field) {
  const values = (hours ?? []).map((hour) => hour?.[field]).filter(Number.isFinite);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

function baseChartStyle() {
  return {
    backgroundColor: "transparent",
    aria: { enabled: true, decal: { show: true } },
    textStyle: { color: "#aebbd0", fontFamily: "system-ui, sans-serif" },
    tooltip: { trigger: "axis", backgroundColor: "#1a2154", borderColor: "#4a5599", textStyle: { color: "#f4f6ff" } },
    grid: { left: 38, right: 14, top: 38, bottom: 32 },
    animationDurationUpdate: 180,
  };
}

function buildNightTrendChart(items) {
  const labels = items.map((item) => {
    const [, month, day] = item.nightKey.split("-").map(Number);
    return `${month}/${day}`;
  });
  const scores = items.map((item) => item.evaluation?.score ?? null);
  const cloud = items.map((item) => averageNumeric(item.evaluation?.hours, "cloudCover"));
  const windows = items.map((item) => item.evaluation?.window?.length ?? null);
  const tooltipUnits = { 星空分: "分", 平均总云量: "%", 连续窗口: "h" };
  const base = baseChartStyle();
  return {
    ...base,
    grid: { left: 42, right: 42, top: 42, bottom: 38 },
    tooltip: {
      ...base.tooltip,
      formatter: (params) => {
        const rows = Array.isArray(params) ? params : [params];
        const title = rows[0]?.axisValueLabel ?? "";
        return [title, ...rows.map((row) => `${row.marker}${row.seriesName}：${Number.isFinite(row.value) ? row.value : "—"}${Number.isFinite(row.value) ? tooltipUnits[row.seriesName] ?? "" : ""}`)].join("<br/>");
      },
    },
    legend: { top: 0, textStyle: { color: "#aebbd0" }, data: ["星空分", "平均总云量", "连续窗口"] },
    xAxis: { type: "category", data: labels, axisLine: { lineStyle: { color: "#33425d" } }, axisLabel: { color: "#aebbd0", interval: 0 } },
    yAxis: [
      { type: "value", min: 0, max: 100, name: "评分 / 云量 %", nameTextStyle: { color: "#8393ad" }, axisLabel: { color: "#8393ad" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
      { type: "value", min: 0, max: 10, name: "小时", nameTextStyle: { color: "#8393ad" }, axisLabel: { color: "#8393ad", formatter: "{value}h" }, splitLine: { show: false } },
    ],
    series: [
      { name: "平均总云量", type: "bar", data: cloud, barMaxWidth: 30, itemStyle: { color: "rgba(126, 148, 181, .48)", borderColor: "#aebbd0", borderWidth: 1 }, label: { show: true, position: "top", color: "#aebbd0", formatter: ({ value }) => Number.isFinite(value) ? `${value}%` : "—" } },
      { name: "星空分", type: "line", smooth: true, data: scores, symbolSize: 8, lineStyle: { color: "#79cfe2", width: 3 }, itemStyle: { color: "#79cfe2" }, label: { show: true, position: "top", color: "#79cfe2", formatter: ({ value }) => Number.isFinite(value) ? `${value}分` : "—" } },
      { name: "连续窗口", type: "line", yAxisIndex: 1, data: windows, symbol: "diamond", symbolSize: 8, lineStyle: { color: "#d4b273", type: "dashed", width: 2 }, itemStyle: { color: "#d4b273" }, label: { show: true, position: "bottom", color: "#d4b273", formatter: ({ value }) => Number.isFinite(value) ? `${value}h` : "—" } },
    ],
  };
}

function buildWeatherChart(hours) {
  return {
    ...baseChartStyle(),
    legend: { top: 0, textStyle: { color: "#9aabc3" }, data: ["总云", "低云", "降水概率", "阵风"] },
    xAxis: { type: "category", data: hours.map((hour) => formatHour(hour.time)), axisLine: { lineStyle: { color: "#33425d" } }, axisLabel: { color: "#8393ad", interval: 1 } },
    yAxis: [{ type: "value", min: 0, max: 100, axisLabel: { color: "#8393ad", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#1d2a40" } } }, { type: "value", axisLabel: { color: "#8393ad", formatter: "{value}m/s" }, splitLine: { show: false } }],
    series: [
      { name: "总云", type: "line", smooth: true, data: hours.map((hour) => hour.cloudCover), lineStyle: { color: "#d5e1f0" }, itemStyle: { color: "#d5e1f0" }, areaStyle: { color: "rgba(213,225,240,.08)" } },
      { name: "低云", type: "line", smooth: true, data: hours.map((hour) => hour.cloudLow), lineStyle: { color: "#36d2e7" }, itemStyle: { color: "#36d2e7" } },
      { name: "降水概率", type: "bar", data: hours.map((hour) => hour.precipitationProbability), itemStyle: { color: "rgba(79,132,255,.42)" } },
      { name: "阵风", type: "line", yAxisIndex: 1, data: hours.map((hour) => hour.windGust), lineStyle: { color: "#f5ae52", type: "dashed" }, itemStyle: { color: "#f5ae52" } },
    ],
  };
}

function buildAstroChart(hours) {
  return {
    ...baseChartStyle(),
    legend: { top: 0, textStyle: { color: "#9aabc3" }, data: ["太阳", "月亮", "银河核心"] },
    xAxis: { type: "category", data: hours.map((hour) => formatHour(hour.time)), axisLine: { lineStyle: { color: "#33425d" } }, axisLabel: { color: "#8393ad", interval: 1 } },
    yAxis: { type: "value", min: -40, max: 90, axisLabel: { color: "#8393ad", formatter: "{value}°" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
    series: [
      { name: "太阳", type: "line", smooth: true, data: hours.map((hour) => Math.round(hour.sunAltitude)), lineStyle: { color: "#f5ae52" }, itemStyle: { color: "#f5ae52" }, markLine: { symbol: "none", label: { formatter: "天文黑夜 -18°", color: "#74839b" }, lineStyle: { color: "#596780", type: "dashed" }, data: [{ yAxis: -18 }] } },
      { name: "月亮", type: "line", smooth: true, data: hours.map((hour) => Math.round(hour.moonAltitude)), lineStyle: { color: "#dbe8f6" }, itemStyle: { color: "#dbe8f6" } },
      { name: "银河核心", type: "line", smooth: true, data: hours.map((hour) => Math.round(hour.galacticAltitude)), lineStyle: { color: "#36d2e7", width: 3 }, itemStyle: { color: "#36d2e7" } },
    ],
  };
}

function buildProfileChart(profile, siteElevation) {
  const valid = profile.filter((level) => Number.isFinite(level.heightMsl));
  return {
    ...baseChartStyle(),
    grid: { left: 58, right: 18, top: 24, bottom: 34 },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#8393ad", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
    yAxis: { type: "value", name: "MSL m", nameTextStyle: { color: "#8393ad" }, axisLabel: { color: "#8393ad" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
    series: [{ name: "压力层云量", type: "line", data: valid.map((level) => [level.cloudCover ?? 0, level.heightMsl]), lineStyle: { color: "#36d2e7", width: 3 }, itemStyle: { color: "#36d2e7" }, areaStyle: { color: "rgba(54,210,231,.1)" }, markLine: { symbol: "none", label: { formatter: `机位 ${siteElevation}m`, color: "#f5ae52" }, lineStyle: { color: "#f5ae52", type: "dashed" }, data: [{ yAxis: siteElevation }] } }],
  };
}
