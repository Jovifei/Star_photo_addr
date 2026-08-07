"use client";

// Global application state: a React Context + useReducer store (no extra deps).
// Holds the active sample, selected location, its forecast, the night window,
// Bortle/cloud toggles and the candidate list. Action methods perform the
// side-effects (pixel sampling, forecast fetch) and dispatch results.

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import {
  DEFAULT_CLOUD_STATE,
  DEFAULT_NIGHT_KEY,
  METEOR_SHOWER_NIGHTS,
} from "@/lib/constants";
import { sampleBortle } from "@/lib/darksky";
import { hasDarkSkyLayer } from "@/lib/assets";
import type {
  CityCandidate,
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
};

type Action =
  | { type: "SET_SAMPLE"; sample: DarkSkySample | null }
  | { type: "SET_LOCATION"; location: Location | null }
  | { type: "SET_FORECAST"; forecast: LocationForecast | null }
  | { type: "SELECT_NIGHT"; nightKey: string }
  | { type: "SET_BORTLE"; enabled: boolean }
  | { type: "SET_CLOUD"; partial: Partial<CloudState> }
  | { type: "SET_CANDIDATES"; candidates: CityCandidate[] }
  | { type: "SET_DETAIL_OPEN"; open: boolean }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_SAMPLE":
      return { ...state, sample: action.sample };
    case "SET_LOCATION":
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
    case "SET_DETAIL_OPEN":
      return { ...state, detailOpen: action.open };
    case "SET_LOADING":
      return { ...state, loading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
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
  setDetailOpen: (open: boolean) => void;
  locate: (latitude: number, longitude: number) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const selectLocation = useCallback(async (location: Location) => {
    dispatch({ type: "SET_LOCATION", location });
    dispatch({ type: "SET_DETAIL_OPEN", open: true });
    dispatch({ type: "SET_LOADING", loading: true });
    dispatch({ type: "SET_ERROR", error: "" });
    try {
      const forecast = await fetchForecastFor(location);
      dispatch({ type: "SET_FORECAST", forecast });
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

  const setDetailOpen = useCallback((open: boolean) => {
    dispatch({ type: "SET_DETAIL_OPEN", open });
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
      setDetailOpen,
      locate,
    }),
    [
      state,
      selectLocation,
      sampleAt,
      selectNight,
      toggleBortle,
      setCloud,
      setCandidates,
      setDetailOpen,
      locate,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
