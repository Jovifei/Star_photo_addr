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
  DEFAULT_NIGHT_KEY,
  METEOR_SHOWER_NIGHTS,
  SELECTED_LOCATION_STORAGE_KEY,
} from "@/lib/constants";
import { sampleBortle } from "@/lib/darksky";
import { hasDarkSkyLayer } from "@/lib/assets";
import type {
  CityCandidate,
  CloudGridData,
  CloudState,
  DarkSkySample,
  Location,
  LocationForecast,
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
  /**
   * Multi-location forecast cache for the star-window table.
   * Key = locationId, value = LocationForecast (1 h expiry handled by caller).
   */
  forecastCache: Map<string, LocationForecast>;
}

const initialState: AppState = {
  sample: null,
  selectedLocation: null,
  forecast: null,
  nightKeys: [...METEOR_SHOWER_NIGHTS],
  selectedNight: DEFAULT_NIGHT_KEY,
  // Off by default when no dark-sky raster is installed, so the map never
  // mounts a layer whose tiles would all 404.
  bortleEnabled: hasDarkSkyLayer(),
  cloudState: { ...DEFAULT_CLOUD_STATE },
  candidates: [],
  detailOpen: false,
  loading: false,
  error: "",
  cloudGrid: null,
  cloudGridLoading: false,
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
      return { ...state, candidates: action.candidates };
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
): Promise<LocationForecast | null> {
  const url = `/api/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=14`;
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
  selectLocation: (location: Location) => Promise<void>;
  sampleAt: (
    latitude: number,
    longitude: number,
    elevation?: number,
    name?: string,
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
  cacheForecast: (locationId: string, forecast: LocationForecast) => void;
  clearForecastCache: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

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
        typeof parsed.id === "string" &&
        typeof parsed.name === "string"
      ) {
        dispatch({ type: "HYDRATE_LOCATION", location: parsed });
      }
    } catch {
      // Ignore parse errors — stale or corrupt data.
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

  const selectLocation = useCallback(async (location: Location) => {
    dispatch({ type: "SET_LOCATION", location });
    dispatch({ type: "SET_DETAIL_OPEN", open: true });
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const forecast = await fetchForecastFor(location);
      dispatch({ type: "SET_FORECAST", forecast });
      if (forecast) {
        dispatch({
          type: "CACHE_FORECAST",
          locationId: location.id,
          forecast,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "天气请求失败";
      dispatch({ type: "SET_ERROR", error: message });
    } finally {
      dispatch({ type: "SET_LOADING", loading: false });
    }
  }, []);

  const sampleAt = useCallback(
    async (
      latitude: number,
      longitude: number,
      elevation = 0,
      name?: string,
    ) => {
      const location: Location = {
        id: `custom-${Date.now()}`,
        name: name ?? "取样点",
        latitude,
        longitude,
        elevation,
        source: name ? "搜索" : "自定义",
      };
      dispatch({ type: "SET_LOCATION", location });
      dispatch({ type: "SET_DETAIL_OPEN", open: true });
      dispatch({ type: "SET_LOADING", loading: true });
      try {
        const [sample, forecast] = await Promise.all([
          sampleBortle(latitude, longitude),
          fetchForecastFor(location),
        ]);
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
        const message = error instanceof Error ? error.message : "取样或天气请求失败";
        dispatch({ type: "SET_ERROR", error: message });
      } finally {
        dispatch({ type: "SET_LOADING", loading: false });
      }
    },
    [],
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
