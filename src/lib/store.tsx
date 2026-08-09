"use client";

// Global application state: a React Context + useReducer store (no extra deps).
// Holds the active sample, selected location, its forecast, the night window,
// Bortle/cloud toggles, the candidate list, cloud-grid sampling data, and a
// multi-location forecast cache. Action methods perform side-effects (pixel
// sampling, forecast fetch) and dispatch results.
//
// v2 changes:
//   - StoreProvider is now mounted at layout.tsx level (global Context) so
//     both / and /viirs pages share the same state.
//   - selectedLocation is persisted to localStorage (debounced 500 ms) and
//     restored on mount.
//   - New state fields: cloudGrid, cloudGridLoading, forecastCache.
//   - New actions: setCloudGrid, setCloudGridLoading, addCandidate,
//     removeCandidate, clearForecastCache.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import {
  DEFAULT_CLOUD_STATE,
  CUSTOM_CANDIDATES_STORAGE_KEY,
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
  Location,
  LocationForecast,
  SatelliteFrame,
} from "@/lib/types";

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
  /** Cloud-grid spatial sampling data (Phase 2). */
  cloudGrid: CloudGridData | null;
  /** Whether a cloud-grid fetch is in progress. */
  cloudGridLoading: boolean;
  /** Latest satellite frame list shared by the map and the time workbench. */
  satelliteFrames: SatelliteFrame[];
  /**
   * Multi-location forecast cache for the star-window table.
   * Key = locationId, value = LocationForecast (1 h expiry handled by caller).
   */
  forecastCache: Map<string, LocationForecast>;
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
  // Off by default when no dark-sky raster is installed, so the map never
  // mounts a layer whose tiles would all 404.
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
  | {
      type: "CACHE_FORECAST";
      locationId: string;
      forecast: LocationForecast;
    }
  | { type: "CLEAR_FORECAST_CACHE" }
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
          ...action.candidates,
          ...state.candidates.filter(
            (candidate) =>
              candidate.kind === "自定义" &&
              !action.candidates.some((incoming) => incoming.id === candidate.id),
          ),
        ],
      };
    case "ADD_CANDIDATE": {
      // Avoid duplicate IDs.
      if (state.candidates.some((c) => c.id === action.candidate.id)) {
        return state;
      }
      return { ...state, candidates: [...state.candidates, action.candidate] };
    }
    case "REMOVE_CANDIDATE":
      return {
        ...state,
        candidates: state.candidates.filter((c) => c.id !== action.id),
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
    default:
      return state;
  }
}

async function fetchForecastFor(
  location: Location,
  model: CloudState["model"] = "icon",
): Promise<LocationForecast | null> {
  const url = `/api/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=14&model=${model}`;
  const response = await fetch(url);
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
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const forecastHydrationKeyRef = useRef<string | null>(null);
  const selectedLocationIdRef = useRef<string | null>(null);
  const latestForecastRequestRef = useRef(0);

  useEffect(() => {
    selectedLocationIdRef.current = state.selectedLocation?.id ?? null;
  }, [state.selectedLocation]);

  // ----- localStorage persistence (debounced 500 ms) -----
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore selectedLocation from localStorage on mount.
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
        // Remove the exact placeholder produced by the old bridge bug where
        // Number(null) turned a coordinate-less planner link into 0,0. An
        // explicitly entered 0,0 location remains legal and is not removed.
        const isLegacyPlaceholder =
          parsed.id === "planner-0.00000-0.00000" &&
          parsed.name === "星野决策点位" &&
          parsed.source === "搜索";
        if (isLegacyPlaceholder) {
          localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
        } else {
          dispatch({ type: "HYDRATE_LOCATION", location: parsed });
        }
      } else {
        localStorage.removeItem(SELECTED_LOCATION_STORAGE_KEY);
      }
    } catch {
      // Ignore parse errors — stale or corrupt data.
    }
  }, []);

  // Restore user-added comparison locations independently from provider data.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_CANDIDATES_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as CityCandidate[]) : [];
      if (Array.isArray(parsed) && parsed.length) {
        dispatch({ type: "SET_CANDIDATES", candidates: parsed });
      }
    } catch {
      // Ignore stale/corrupt local data.
    }
  }, []);

  // Debounced write whenever selectedLocation changes.
  useEffect(() => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
    }
    if (!state.selectedLocation) return;
    persistTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          SELECTED_LOCATION_STORAGE_KEY,
          JSON.stringify(state.selectedLocation),
        );
      } catch {
        // Quota exceeded or private mode — silently ignore.
      }
    }, 500);
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, [state.selectedLocation]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CUSTOM_CANDIDATES_STORAGE_KEY,
        JSON.stringify(
          state.candidates.filter((candidate) => candidate.kind === "自定义"),
        ),
      );
    } catch {
      // Quota exceeded/private mode — the current session remains usable.
    }
  }, [state.candidates]);

  const selectLocation = useCallback(async (location: Location, model?: CloudState["model"]) => {
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
        dispatch({
          type: "CACHE_FORECAST",
          locationId: location.id,
          forecast,
        });
      }
    } catch (error) {
      if (requestId !== latestForecastRequestRef.current) return;
      const message = error instanceof Error ? error.message : "天气请求失败";
      dispatch({ type: "SET_ERROR", error: message });
    } finally {
      if (requestId === latestForecastRequestRef.current) {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    }
  }, [state.cloudState.model]);

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
          dispatch({
            type: "CACHE_FORECAST",
            locationId: location.id,
            forecast,
          });
        }
      } catch (error) {
        if (requestId !== latestForecastRequestRef.current) return;
        const message = error instanceof Error ? error.message : "取样或天气请求失败";
        dispatch({ type: "SET_ERROR", error: message });
      } finally {
        if (requestId === latestForecastRequestRef.current) {
          dispatch({ type: "SET_LOADING", loading: false });
        }
      }
    },
    [state.cloudState.model],
  );

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
    // Without a raster source there is nothing to toggle on.
    if (!hasDarkSkyLayer()) return;
    dispatch({ type: "SET_BORTLE", enabled: !state.bortleEnabled });
  }, [state.bortleEnabled]);

  const setCloud = useCallback((partial: Partial<CloudState>) => {
    dispatch({ type: "SET_CLOUD", partial });
  }, []);

  const setCandidates = useCallback((candidates: CityCandidate[]) => {
    dispatch({ type: "SET_CANDIDATES", candidates });
  }, []);

  const addCandidate = useCallback((location: Location) => {
    const candidate: CityCandidate = {
      id: location.id,
      adcode: 0,
      province: "",
      city: location.name,
      name: location.name,
      longitude: location.longitude,
      latitude: location.latitude,
      bortle: location.bortle ?? 0,
      kind: "自定义",
      note: "",
    };
    dispatch({ type: "ADD_CANDIDATE", candidate });
  }, []);

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

  // A location restored from localStorage still needs its point forecast.
  // Otherwise the timeline can show a grid average while the control panel
  // has no selected-point forecast for the same active hour.
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
    void fetchForecastFor(location, model).then((forecast) => {
      if (cancelled || !forecast || selectedLocationIdRef.current !== location.id) return;
      dispatch({ type: "SET_FORECAST", forecast });
      dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
    }).catch(() => {
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

  const value = useMemo<StoreContextValue>(
    () => ({
      state,
      selectLocation,
      sampleAt,
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
    }),
    [
      state,
      selectLocation,
      sampleAt,
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
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
