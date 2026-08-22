"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_CLOUD_STATE,
  CUSTOM_CANDIDATES_STORAGE_KEY,
  FORECAST_THEME_STORAGE_KEY,
  OBSERVING_BANDS_STORAGE_KEY,
  OBSERVING_BORTLE_LIMIT_STORAGE_KEY,
  OBSERVING_MAP_VIEW_STORAGE_KEY,
  OBSERVING_RECOMMENDED_ONLY_STORAGE_KEY,
  OBSERVING_THRESHOLD_STORAGE_KEY,
  SELECTED_LOCATION_STORAGE_KEY,
} from "@/lib/constants";
import {
  currentNightKey,
  initialForecastTime,
  nightHourIndex,
  nightRangeKeys,
} from "@/lib/nighttime";
import { sampleBortle } from "@/lib/darksky";
import { hasDarkSkyLayer } from "@/lib/assets";
import type {
  CityCandidate,
  CloudGridData,
  CloudState,
  DarkSkySample,
  ForecastTheme,
  Location,
  LocationForecast,
  MapViewMode,
  RecommendationBand,
  SatelliteFrame,
} from "@/lib/types";
import { MAX_SHORTLIST_SIZE } from "@/lib/observingSites";
import { normalizeLocationTexts } from "@/lib/chineseText";

interface AppState {
  sample: DarkSkySample | null;
  selectedLocation: Location | null;
  forecast: LocationForecast | null;
  nightKeys: string[];
  selectedNight: string;
  bortleEnabled: boolean;
  cloudState: CloudState;
  candidates: CityCandidate[];
  detailOpen: boolean;
  loading: boolean;
  error: string;
  cloudGrid: CloudGridData | null;
  cloudGridLoading: boolean;
  satelliteFrames: SatelliteFrame[];
  forecastCache: Map<string, LocationForecast>;
  mapViewMode: MapViewMode;
  /** Cross-product prediction lens (star vs cloud-sea scoring). */
  forecastTheme: ForecastTheme;
  recommendationThreshold: number;
  observingBortleLimit: 3 | 4;
  recommendedOnly: boolean;
  visibleRecommendationBands: RecommendationBand[];
  /** Monotonic token observed by every data layer after a manual refresh. */
  dataRefreshRevision: number;
}

const homeNight = currentNightKey();
const homeNightKeys = nightRangeKeys(homeNight, 7);
const homeForecastTime = initialForecastTime();

const initialState: AppState = {
  sample: null,
  selectedLocation: null,
  forecast: null,
  nightKeys: homeNightKeys,
  selectedNight: homeNight,
  bortleEnabled: hasDarkSkyLayer(),
  cloudState: {
    ...DEFAULT_CLOUD_STATE,
    activeForecastTime: homeForecastTime,
    timeIndex: nightHourIndex(homeForecastTime),
  },
  candidates: [],
  detailOpen: false,
  loading: false,
  error: "",
  cloudGrid: null,
  cloudGridLoading: false,
  satelliteFrames: [],
  forecastCache: new Map(),
  mapViewMode: "satellite",
  forecastTheme: "star",
  recommendationThreshold: 70,
  observingBortleLimit: 3,
  recommendedOnly: false,
  visibleRecommendationBands: [
    "priority",
    "recommended",
    "watch",
    "not-recommended",
  ],
  dataRefreshRevision: 0,
};

type Action =
  | { type: "SET_SAMPLE"; sample: DarkSkySample | null }
  | { type: "SET_LOCATION"; location: Location | null }
  | { type: "SET_FORECAST"; forecast: LocationForecast | null }
  | { type: "SELECT_NIGHT"; nightKey: string }
  | { type: "SET_BORTLE"; enabled: boolean }
  | { type: "SET_CLOUD"; partial: Partial<CloudState> }
  | { type: "SET_CANDIDATES"; candidates: CityCandidate[] }
  | { type: "ADD_CANDIDATE"; candidate: CityCandidate }
  | { type: "REMOVE_CANDIDATE"; id: string }
  | { type: "SET_DETAIL_OPEN"; open: boolean }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_CLOUD_GRID"; data: CloudGridData | null }
  | { type: "SET_CLOUD_GRID_LOADING"; loading: boolean }
  | { type: "SET_SATELLITE_FRAMES"; frames: SatelliteFrame[] }
  | { type: "CACHE_FORECAST"; locationId: string; forecast: LocationForecast }
  | { type: "CLEAR_FORECAST_CACHE" }
  | { type: "SET_MAP_VIEW_MODE"; mode: MapViewMode }
  | { type: "SET_FORECAST_THEME"; theme: ForecastTheme }
  | { type: "SET_RECOMMENDATION_THRESHOLD"; threshold: number }
  | { type: "SET_OBSERVING_BORTLE_LIMIT"; limit: 3 | 4 }
  | { type: "SET_RECOMMENDED_ONLY"; enabled: boolean }
  | { type: "SET_RECOMMENDATION_BANDS"; bands: RecommendationBand[] }
  | { type: "REFRESH_DATA"; revision: number }
  | { type: "HYDRATE_LOCATION"; location: Location };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_SAMPLE":
      return { ...state, sample: action.sample };
    case "SET_LOCATION":
      return { ...state, selectedLocation: action.location };
    case "HYDRATE_LOCATION":
      return { ...state, selectedLocation: action.location };
    case "SET_FORECAST":
      return { ...state, forecast: action.forecast };
    case "SELECT_NIGHT":
      return { ...state, selectedNight: action.nightKey };
    case "SET_BORTLE":
      return { ...state, bortleEnabled: action.enabled };
    case "SET_CLOUD":
      return { ...state, cloudState: { ...state.cloudState, ...action.partial } };
    case "SET_CANDIDATES":
      return {
        ...state,
        candidates: [
          ...action.candidates.slice(0, MAX_SHORTLIST_SIZE),
          ...state.candidates.filter(
            (candidate) =>
              !action.candidates.some(
                (incoming) => incoming.id === candidate.id,
              ),
          ),
        ].slice(0, MAX_SHORTLIST_SIZE),
      };
    case "ADD_CANDIDATE":
      if (state.candidates.some((candidate) => candidate.id === action.candidate.id)) {
        return state;
      }
      return {
        ...state,
        candidates:
          state.candidates.length >= MAX_SHORTLIST_SIZE
            ? state.candidates
            : [...state.candidates, action.candidate],
      };
    case "REMOVE_CANDIDATE":
      return {
        ...state,
        candidates: state.candidates.filter((candidate) => candidate.id !== action.id),
      };
    case "SET_DETAIL_OPEN":
      return { ...state, detailOpen: action.open };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "SET_CLOUD_GRID":
      return { ...state, cloudGrid: action.data };
    case "SET_CLOUD_GRID_LOADING":
      return { ...state, cloudGridLoading: action.loading };
    case "SET_SATELLITE_FRAMES":
      return { ...state, satelliteFrames: action.frames };
    case "CACHE_FORECAST": {
      const next = new Map(state.forecastCache);
      next.set(action.locationId, action.forecast);
      return { ...state, forecastCache: next };
    }
    case "CLEAR_FORECAST_CACHE":
      return { ...state, forecastCache: new Map() };
    case "SET_MAP_VIEW_MODE":
      return { ...state, mapViewMode: action.mode };
    case "SET_FORECAST_THEME":
      return { ...state, forecastTheme: action.theme };
    case "SET_RECOMMENDATION_THRESHOLD":
      return {
        ...state,
        recommendationThreshold: Math.min(
          90,
          Math.max(50, Math.round(action.threshold)),
        ),
      };
    case "SET_OBSERVING_BORTLE_LIMIT":
      return { ...state, observingBortleLimit: action.limit };
    case "SET_RECOMMENDED_ONLY":
      return { ...state, recommendedOnly: action.enabled };
    case "SET_RECOMMENDATION_BANDS":
      return { ...state, visibleRecommendationBands: action.bands };
    case "REFRESH_DATA":
      return { ...state, dataRefreshRevision: action.revision };
    default:
      return state;
  }
}

async function fetchForecastFor(
  location: Location,
  model: CloudState["model"] = "icon",
  forceRefresh = false,
): Promise<LocationForecast | null> {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    days: "14",
    model,
  });
  if (forceRefresh) params.set("refresh", "1");
  const response = await fetch(`/api/forecast?${params.toString()}`, {
    cache: forceRefresh ? "no-store" : "default",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `天气请求失败 (${response.status})`);
  }
  const data = await response.json();
  return data.locations?.[0] ?? null;
}

interface StoreContextValue {
  state: AppState;
  selectLocation: (location: Location, model?: CloudState["model"]) => Promise<void>;
  sampleAt: (
    latitude: number,
    longitude: number,
    elevation?: number,
    name?: string,
    model?: CloudState["model"],
  ) => Promise<void>;
  refreshData: () => Promise<void>;
  selectNight: (nightKey: string) => void;
  toggleBortle: () => void;
  setCloud: (partial: Partial<CloudState>) => void;
  setCandidates: (candidates: CityCandidate[]) => void;
  addCandidate: (location: Location) => void;
  removeCandidate: (id: string) => void;
  setDetailOpen: (open: boolean) => void;
  locate: (latitude: number, longitude: number) => void;
  setCloudGrid: (data: CloudGridData | null) => void;
  setCloudGridLoading: (loading: boolean) => void;
  setSatelliteFrames: (frames: SatelliteFrame[]) => void;
  cacheForecast: (locationId: string, forecast: LocationForecast) => void;
  clearForecastCache: () => void;
  setMapViewMode: (mode: MapViewMode) => void;
  setForecastTheme: (theme: ForecastTheme) => void;
  setRecommendationThreshold: (threshold: number) => void;
  setObservingBortleLimit: (limit: 3 | 4) => void;
  setRecommendedOnly: (enabled: boolean) => void;
  setRecommendationBands: (bands: RecommendationBand[]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [candidatesHydrated, setCandidatesHydrated] = useState(false);
  const forecastHydrationKeyRef = useRef<string | null>(null);
  const selectedLocationIdRef = useRef<string | null>(null);
  const latestForecastRequestRef = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    selectedLocationIdRef.current = state.selectedLocation?.id ?? null;
  }, [state.selectedLocation]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SELECTED_LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Location;
      if (
        parsed &&
        typeof parsed.latitude === "number" &&
        typeof parsed.longitude === "number" &&
        Number.isFinite(parsed.latitude) &&
        Number.isFinite(parsed.longitude) &&
        parsed.latitude >= -90 &&
        parsed.latitude <= 90 &&
        parsed.longitude >= -180 &&
        parsed.longitude <= 180 &&
        typeof parsed.id === "string" &&
        typeof parsed.name === "string"
      ) {
        const isLegacyPlaceholder =
          parsed.id === "planner-0.00000-0.00000" &&
          parsed.name === "星野决策点位" &&
          parsed.source === "搜索";
        if (isLegacyPlaceholder) {
          localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
        } else {
          // Legacy picks may carry traditional names from the geocoder; the
          // debounced persist effect rewrites the stored value normalized.
          dispatch({ type: "HYDRATE_LOCATION", location: normalizeLocationTexts(parsed) });
        }
      } else {
        localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
      }
    } catch {
      // Optional persisted state may be corrupt or unavailable.
    }
  }, []);

  useEffect(() => {
    try {
      const mode = localStorage.getItem(OBSERVING_MAP_VIEW_STORAGE_KEY);
      if (mode === "satellite" || mode === "light-pollution" || mode === "combined") {
        dispatch({ type: "SET_MAP_VIEW_MODE", mode });
      }
      const theme = localStorage.getItem(FORECAST_THEME_STORAGE_KEY);
      if (theme === "star" || theme === "cloud") {
        dispatch({ type: "SET_FORECAST_THEME", theme });
      }
      const threshold = Number(localStorage.getItem(OBSERVING_THRESHOLD_STORAGE_KEY));
      if (Number.isFinite(threshold)) {
        dispatch({ type: "SET_RECOMMENDATION_THRESHOLD", threshold });
      }
      const limit = Number(localStorage.getItem(OBSERVING_BORTLE_LIMIT_STORAGE_KEY));
      if (limit === 3 || limit === 4) {
        dispatch({ type: "SET_OBSERVING_BORTLE_LIMIT", limit });
      }
      const recommendedOnly = localStorage.getItem(OBSERVING_RECOMMENDED_ONLY_STORAGE_KEY);
      if (recommendedOnly === "true" || recommendedOnly === "false") {
        dispatch({ type: "SET_RECOMMENDED_ONLY", enabled: recommendedOnly === "true" });
      }
      const bands = localStorage.getItem(OBSERVING_BANDS_STORAGE_KEY);
      if (bands) {
        const parsed = JSON.parse(bands) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (band) =>
              band === "priority" ||
              band === "recommended" ||
              band === "watch" ||
              band === "not-recommended",
          )
        ) {
          dispatch({ type: "SET_RECOMMENDATION_BANDS", bands: parsed as RecommendationBand[] });
        }
      }
    } catch {
      // Local preferences are optional.
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_CANDIDATES_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CityCandidate[]) : [];
      if (Array.isArray(parsed) && parsed.length) {
        dispatch({ type: "SET_CANDIDATES", candidates: parsed.map(normalizeLocationTexts) });
      }
    } catch {
      // Ignore stale/corrupt local data.
    } finally {
      setCandidatesHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    if (!state.selectedLocation) return;
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          SELECTED_LOCATION_STORAGE_KEY,
          JSON.stringify(state.selectedLocation),
        );
      } catch {
        // Persistence failure does not block the current session.
      }
    }, 500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state.selectedLocation]);

  useEffect(() => {
    if (!candidatesHydrated) return;
    try {
      localStorage.setItem(
        CUSTOM_CANDIDATES_STORAGE_KEY,
        JSON.stringify(state.candidates),
      );
    } catch {
      // Current in-memory candidates remain usable.
    }
  }, [candidatesHydrated, state.candidates]);

  const selectLocation = useCallback(
    async (location: Location, model?: CloudState["model"]) => {
      const selectedModel = model ?? state.cloudState.model;
      const requestId = ++latestForecastRequestRef.current;
      selectedLocationIdRef.current = location.id;
      dispatch({ type: "SET_LOCATION", location });
      dispatch({ type: "SET_DETAIL_OPEN", open: true });
      dispatch({ type: "SET_LOADING", loading: true });
      dispatch({ type: "SET_ERROR", error: "" });
      dispatch({ type: "SET_SAMPLE", sample: null });
      dispatch({ type: "SET_FORECAST", forecast: null });
      try {
        const forecast = await fetchForecastFor(location, selectedModel);
        if (requestId !== latestForecastRequestRef.current) return;
        dispatch({ type: "SET_FORECAST", forecast });
        if (forecast) {
          dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
        }
      } catch (error) {
        if (requestId !== latestForecastRequestRef.current) return;
        dispatch({
          type: "SET_ERROR",
          error: error instanceof Error ? error.message : "天气请求失败",
        });
      } finally {
        if (requestId === latestForecastRequestRef.current) {
          dispatch({ type: "SET_LOADING", loading: false });
        }
      }
    },
    [state.cloudState.model],
  );

  const sampleAt = useCallback(
    async (
      latitude: number,
      longitude: number,
      elevation = 0,
      name?: string,
      model?: CloudState["model"],
    ) => {
      const selectedModel = model ?? state.cloudState.model;
      const requestId = ++latestForecastRequestRef.current;
      const location: Location = {
        id: `custom-${Date.now()}`,
        name: name ?? "取样点",
        latitude,
        longitude,
        elevation,
        source: name ? "搜索" : "自定义",
      };
      selectedLocationIdRef.current = location.id;
      dispatch({ type: "SET_LOCATION", location });
      dispatch({ type: "SET_DETAIL_OPEN", open: true });
      dispatch({ type: "SET_LOADING", loading: true });
      dispatch({ type: "SET_SAMPLE", sample: null });
      dispatch({ type: "SET_FORECAST", forecast: null });
      try {
        const [sample, forecast] = await Promise.all([
          sampleBortle(latitude, longitude),
          fetchForecastFor(location, selectedModel),
        ]);
        if (requestId !== latestForecastRequestRef.current) return;
        dispatch({ type: "SET_SAMPLE", sample });
        dispatch({ type: "SET_FORECAST", forecast });
        if (forecast) {
          dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
        }
      } catch (error) {
        if (requestId !== latestForecastRequestRef.current) return;
        dispatch({
          type: "SET_ERROR",
          error: error instanceof Error ? error.message : "取样或天气请求失败",
        });
      } finally {
        if (requestId === latestForecastRequestRef.current) {
          dispatch({ type: "SET_LOADING", loading: false });
        }
      }
    },
    [state.cloudState.model],
  );

  const refreshData = useCallback(async () => {
    const revision = Date.now();
    dispatch({ type: "REFRESH_DATA", revision });
    dispatch({ type: "SET_ERROR", error: "" });
    const location = state.selectedLocation;
    if (!location) return;
    const requestId = ++latestForecastRequestRef.current;
    dispatch({ type: "SET_LOADING", loading: true });
    try {
      const forecast = await fetchForecastFor(
        location,
        state.cloudState.model,
        true,
      );
      if (
        requestId !== latestForecastRequestRef.current ||
        selectedLocationIdRef.current !== location.id
      ) {
        return;
      }
      dispatch({ type: "SET_FORECAST", forecast });
      if (forecast) {
        dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
      }
    } catch (error) {
      if (requestId !== latestForecastRequestRef.current) return;
      dispatch({
        type: "SET_ERROR",
        error: error instanceof Error ? error.message : "数据刷新失败",
      });
    } finally {
      if (requestId === latestForecastRequestRef.current) {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    }
  }, [state.cloudState.model, state.selectedLocation]);

  const locate = useCallback(
    (latitude: number, longitude: number) => {
      void sampleAt(latitude, longitude);
    },
    [sampleAt],
  );
  const selectNight = useCallback((nightKey: string) => {
    dispatch({ type: "SELECT_NIGHT", nightKey });
  }, []);
  const toggleBortle = useCallback(() => {
    if (!hasDarkSkyLayer()) return;
    dispatch({ type: "SET_BORTLE", enabled: !state.bortleEnabled });
  }, [state.bortleEnabled]);
  const setCloud = useCallback((partial: Partial<CloudState>) => {
    dispatch({ type: "SET_CLOUD", partial });
  }, []);
  const setCandidates = useCallback((candidates: CityCandidate[]) => {
    dispatch({ type: "SET_CANDIDATES", candidates });
  }, []);
  const addCandidate = useCallback(
    (location: Location) => {
      if (state.candidates.length >= MAX_SHORTLIST_SIZE) return;
      dispatch({
        type: "ADD_CANDIDATE",
        candidate: {
          id: location.id,
          adcode: 0,
          province: location.province ?? "",
          city: location.name,
          name: location.name,
          longitude: location.longitude,
          latitude: location.latitude,
          bortle: location.bortle ?? 0,
          kind: "自定义",
          note: location.description ?? location.area ?? "",
        },
      });
    },
    [state.candidates.length],
  );
  const removeCandidate = useCallback((id: string) => {
    dispatch({ type: "REMOVE_CANDIDATE", id });
  }, []);
  const setDetailOpen = useCallback((open: boolean) => {
    dispatch({ type: "SET_DETAIL_OPEN", open });
  }, []);
  const setCloudGrid = useCallback((data: CloudGridData | null) => {
    dispatch({ type: "SET_CLOUD_GRID", data });
  }, []);
  const setCloudGridLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_CLOUD_GRID_LOADING", loading });
  }, []);

  useEffect(() => {
    const location = state.selectedLocation;
    const model = state.cloudState.model;
    const loadedModel = state.forecast?.metadata?.model;
    const hydrationKey = location ? `${location.id}|${model}` : null;
    if (
      !location ||
      state.loading ||
      (state.forecast && loadedModel === model) ||
      forecastHydrationKeyRef.current === hydrationKey
    ) {
      return;
    }
    forecastHydrationKeyRef.current = hydrationKey;
    let cancelled = false;
    void fetchForecastFor(location, model)
      .then((forecast) => {
        if (
          cancelled ||
          !forecast ||
          selectedLocationIdRef.current !== location.id
        ) {
          return;
        }
        dispatch({ type: "SET_FORECAST", forecast });
        dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
      })
      .catch(() => {
        if (forecastHydrationKeyRef.current === hydrationKey) {
          forecastHydrationKeyRef.current = null;
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.cloudState.model, state.forecast, state.loading, state.selectedLocation]);

  const setSatelliteFrames = useCallback((frames: SatelliteFrame[]) => {
    dispatch({ type: "SET_SATELLITE_FRAMES", frames });
  }, []);
  const cacheForecast = useCallback(
    (locationId: string, forecast: LocationForecast) => {
      dispatch({ type: "CACHE_FORECAST", locationId, forecast });
    },
    [],
  );
  const clearForecastCache = useCallback(() => {
    dispatch({ type: "CLEAR_FORECAST_CACHE" });
  }, []);
  const setMapViewMode = useCallback((mode: MapViewMode) => {
    dispatch({ type: "SET_MAP_VIEW_MODE", mode });
    try {
      localStorage.setItem(OBSERVING_MAP_VIEW_STORAGE_KEY, mode);
    } catch {
      // Optional preference.
    }
  }, []);
  const setForecastTheme = useCallback((theme: ForecastTheme) => {
    dispatch({ type: "SET_FORECAST_THEME", theme });
    try {
      localStorage.setItem(FORECAST_THEME_STORAGE_KEY, theme);
    } catch {
      // Optional preference.
    }
  }, []);
  const setRecommendationThreshold = useCallback((threshold: number) => {
    dispatch({ type: "SET_RECOMMENDATION_THRESHOLD", threshold });
    try {
      localStorage.setItem(OBSERVING_THRESHOLD_STORAGE_KEY, String(threshold));
    } catch {
      // Optional preference.
    }
  }, []);
  const setObservingBortleLimit = useCallback((limit: 3 | 4) => {
    dispatch({ type: "SET_OBSERVING_BORTLE_LIMIT", limit });
    try {
      localStorage.setItem(OBSERVING_BORTLE_LIMIT_STORAGE_KEY, String(limit));
    } catch {
      // Optional preference.
    }
  }, []);
  const setRecommendedOnly = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_RECOMMENDED_ONLY", enabled });
    try {
      localStorage.setItem(OBSERVING_RECOMMENDED_ONLY_STORAGE_KEY, String(enabled));
    } catch {
      // Optional preference.
    }
  }, []);
  const setRecommendationBands = useCallback((bands: RecommendationBand[]) => {
    const next = bands.filter((band, index) => bands.indexOf(band) === index);
    dispatch({ type: "SET_RECOMMENDATION_BANDS", bands: next });
    try {
      localStorage.setItem(OBSERVING_BANDS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Optional preference.
    }
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      selectLocation,
      sampleAt,
      refreshData,
      selectNight,
      toggleBortle,
      setCloud,
      setCandidates,
      addCandidate,
      removeCandidate,
      setDetailOpen,
      locate,
      setCloudGrid,
      setCloudGridLoading,
      setSatelliteFrames,
      cacheForecast,
      clearForecastCache,
      setMapViewMode,
      setForecastTheme,
      setRecommendationThreshold,
      setObservingBortleLimit,
      setRecommendedOnly,
      setRecommendationBands,
    }),
    [
      state,
      selectLocation,
      sampleAt,
      refreshData,
      selectNight,
      toggleBortle,
      setCloud,
      setCandidates,
      addCandidate,
      removeCandidate,
      setDetailOpen,
      locate,
      setCloudGrid,
      setCloudGridLoading,
      setSatelliteFrames,
      cacheForecast,
      clearForecastCache,
      setMapViewMode,
      setForecastTheme,
      setRecommendationThreshold,
      setObservingBortleLimit,
      setRecommendedOnly,
      setRecommendationBands,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within StoreProvider");
  return context;
}
