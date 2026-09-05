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
  DEFAULT_CANDIDATE_SEEDS,
  CUSTOM_CANDIDATES_STORAGE_KEY,
  FORECAST_THEME_STORAGE_KEY,
  OBSERVING_BANDS_STORAGE_KEY,
  OBSERVING_BORTLE_LEVELS_STORAGE_KEY,
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
import { resolveElevation } from "@/lib/elevationLookup";
import type {
  BortleLevel,
  CityCandidate,
  CloudGridData,
  CloudState,
  DarkSkySample,
  ForecastTheme,
  Location,
  LocationForecast,
  MapViewMode,
  MapWorkspace,
  RecommendationBand,
  SatelliteFrame,
} from "@/lib/types";
import {
  DEFAULT_BORTLE_LEVELS,
  bortleLevelsForLimit,
  normalizeBortleLevels,
} from "@/lib/bortleFilters";
import { MAX_SHORTLIST_SIZE } from "@/lib/observingSites";
import { normalizeLocationTexts } from "@/lib/chineseText";
import {
  dedupeLocationIdentities,
  sameLocationIdentity,
  stableSampleLocationId,
} from "@/lib/locationIdentity";

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
  /** Explicit upstream-state reporting for the selected location's forecast. */
  forecastAvailability: {
    error: string | null;
    lastSuccessAt: string | null;
    staleInUse: boolean;
  };
  cloudGrid: CloudGridData | null;
  cloudGridLoading: boolean;
  satelliteFrames: SatelliteFrame[];
  forecastCache: Map<string, LocationForecast>;
  mapViewMode: MapViewMode;
  /** Which question the shared map answers tonight vs long-term baseline. */
  mapWorkspace: MapWorkspace;
  /** Cross-product prediction lens (star vs cloud-sea scoring). */
  forecastTheme: ForecastTheme;
  recommendationThreshold: number;
  /** Individually selected Bortle classes; default is B1-B3. */
  observingBortleLevels: BortleLevel[];
  /** Legacy contiguous limit retained for old callers and localStorage migration. */
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
  candidates: [...DEFAULT_CANDIDATE_SEEDS],
  detailOpen: false,
  loading: false,
  error: "",
  forecastAvailability: { error: null, lastSuccessAt: null, staleInUse: false },
  cloudGrid: null,
  cloudGridLoading: false,
  satelliteFrames: [],
  forecastCache: new Map(),
  mapViewMode: "satellite",
  mapWorkspace: "tonight",
  forecastTheme: "star",
  recommendationThreshold: 70,
  observingBortleLevels: [...DEFAULT_BORTLE_LEVELS],
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
  | { type: "HYDRATE_LOCATION"; location: Location }
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
  | { type: "SET_FORECAST_UNAVAILABLE"; error: string }
  | { type: "SET_FORECAST_SUCCESS"; fetchedAt: string | null }
  | { type: "SET_CLOUD_GRID"; data: CloudGridData | null }
  | { type: "SET_CLOUD_GRID_LOADING"; loading: boolean }
  | { type: "SET_SATELLITE_FRAMES"; frames: SatelliteFrame[] }
  | { type: "CACHE_FORECAST"; locationId: string; forecast: LocationForecast }
  | { type: "CLEAR_FORECAST_CACHE" }
  | { type: "SET_MAP_VIEW_MODE"; mode: MapViewMode }
  | { type: "SET_MAP_WORKSPACE"; workspace: MapWorkspace }
  | { type: "SET_FORECAST_THEME"; theme: ForecastTheme }
  | { type: "SET_RECOMMENDATION_THRESHOLD"; threshold: number }
  | { type: "SET_OBSERVING_BORTLE_LEVELS"; levels: BortleLevel[] }
  | { type: "SET_OBSERVING_BORTLE_LIMIT"; limit: 3 | 4 }
  | { type: "SET_RECOMMENDED_ONLY"; enabled: boolean }
  | { type: "SET_RECOMMENDATION_BANDS"; bands: RecommendationBand[] }
  | { type: "REFRESH_DATA"; revision: number };

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
        candidates: dedupeLocationIdentities(action.candidates).slice(0, MAX_SHORTLIST_SIZE),
      };
    case "ADD_CANDIDATE":
      if (
        state.candidates.some((candidate) =>
          sameLocationIdentity(candidate, action.candidate),
        )
      ) {
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
    case "SET_FORECAST_UNAVAILABLE":
      return {
        ...state,
        forecastAvailability: {
          error: action.error,
          lastSuccessAt: state.forecastAvailability.lastSuccessAt,
          // Previous data stays on screen during a failed manual refresh.
          staleInUse: state.forecast != null,
        },
      };
    case "SET_FORECAST_SUCCESS":
      return {
        ...state,
        forecastAvailability: {
          error: null,
          lastSuccessAt: action.fetchedAt,
          staleInUse: false,
        },
      };
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
    case "SET_MAP_WORKSPACE":
      return { ...state, mapWorkspace: action.workspace };
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
      return {
        ...state,
        observingBortleLevels: bortleLevelsForLimit(action.limit),
        observingBortleLimit: action.limit,
      };
    case "SET_OBSERVING_BORTLE_LEVELS": {
      const levels = normalizeBortleLevels(action.levels);
      return {
        ...state,
        observingBortleLevels: levels,
        observingBortleLimit: levels.includes(4) ? 4 : 3,
      };
    }
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
  setMapWorkspace: (workspace: MapWorkspace) => void;
  setForecastTheme: (theme: ForecastTheme) => void;
  setRecommendationThreshold: (threshold: number) => void;
  setObservingBortleLevels: (levels: BortleLevel[]) => void;
  setObservingBortleLimit: (limit: 3 | 4) => void;
  setRecommendedOnly: (enabled: boolean) => void;
  setRecommendationBands: (bands: RecommendationBand[]) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Minimum gap between two forecast requests for the SAME location. Manual
 * retries and forced refreshes bypass the HTTP cache, so without this guard a
 * fast-failing upstream (Open-Meteo 429) lets click-spam drain the quota.
 */
export const FORECAST_SAMPLE_COOLDOWN_MS = 10_000;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [candidatesHydrated, setCandidatesHydrated] = useState(false);
  const allowEmptyCandidatePersistRef = useRef(false);
  const forecastHydrationKeyRef = useRef<string | null>(null);
  const selectedLocationIdRef = useRef<string | null>(null);
  const latestForecastRequestRef = useRef(0);
  const forecastInFlightRef = useRef(false);
  const lastForecastAttemptRef = useRef<{ key: string; at: number } | null>(null);
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
      if (mode === "satellite" || mode === "combined") {
        dispatch({ type: "SET_MAP_VIEW_MODE", mode });
      }
      // Stargazing workspace always defaults to 'star' theme. Cloud sea has its own dedicated workspace.
      dispatch({ type: "SET_FORECAST_THEME", theme: "star" });
      const threshold = Number(localStorage.getItem(OBSERVING_THRESHOLD_STORAGE_KEY));
      if (Number.isFinite(threshold)) {
        dispatch({ type: "SET_RECOMMENDATION_THRESHOLD", threshold });
      }
      const limit = Number(localStorage.getItem(OBSERVING_BORTLE_LIMIT_STORAGE_KEY));
      if (limit === 3 || limit === 4) {
        dispatch({ type: "SET_OBSERVING_BORTLE_LIMIT", limit });
      }
      const levels = localStorage.getItem(OBSERVING_BORTLE_LEVELS_STORAGE_KEY);
      if (levels) {
        const parsed = JSON.parse(levels) as unknown;
        if (Array.isArray(parsed)) {
          dispatch({
            type: "SET_OBSERVING_BORTLE_LEVELS",
            levels: normalizeBortleLevels(parsed),
          });
        }
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
      if (raw) {
        const parsed = JSON.parse(raw) as CityCandidate[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          dispatch({ type: "SET_CANDIDATES", candidates: parsed.map(normalizeLocationTexts) });
        }
      } else {
        dispatch({ type: "SET_CANDIDATES", candidates: DEFAULT_CANDIDATE_SEEDS.map(normalizeLocationTexts) });
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
      if (state.candidates.length === 0 && !allowEmptyCandidatePersistRef.current) {
        const raw = localStorage.getItem(CUSTOM_CANDIDATES_STORAGE_KEY);
        const stored = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(stored) && stored.length > 0) {
          // The first empty snapshot after mount must not wipe restored records.
          return;
        }
      }
      allowEmptyCandidatePersistRef.current = true;
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
      // This location+model pair now has an explicit request in flight. Mark it
      // so the background hydration effect does not silently retry it: such a
      // retry used to land after a 429 and hide the failure from the user.
      forecastHydrationKeyRef.current = `${location.id}|${selectedModel}`;
      const cached = state.forecastCache.get(location.id);
      dispatch({ type: "SET_LOCATION", location });
      dispatch({ type: "SET_DETAIL_OPEN", open: true });
      dispatch({ type: "SET_LOADING", loading: true });
      dispatch({ type: "SET_ERROR", error: "" });
      dispatch({ type: "SET_SAMPLE", sample: null });
      if (cached) {
        dispatch({ type: "SET_FORECAST", forecast: cached });
      } else {
        dispatch({ type: "SET_FORECAST", forecast: null });
      }
      try {
        const forecast = await fetchForecastFor(location, selectedModel);
        if (requestId !== latestForecastRequestRef.current) return;
        dispatch({ type: "SET_FORECAST", forecast });
        // Record the success so the availability line can show "数据更新".
        // Without this a deep-linked location never reported its freshness,
        // because selectLocation used to skip the availability reducer.
        dispatch({
          type: "SET_FORECAST_SUCCESS",
          fetchedAt: forecast?.fetchedAt ?? new Date().toISOString(),
        });
        if (forecast) {
          dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
        }
      } catch (error) {
        if (requestId !== latestForecastRequestRef.current) return;
        const message = error instanceof Error ? error.message : "天气请求失败";
        const fallback = state.forecastCache.get(location.id);
        if (fallback) {
          dispatch({ type: "SET_FORECAST", forecast: fallback });
        }
        dispatch({ type: "SET_ERROR", error: message });
        // Surface the upstream failure (429 / timeout) in the availability
        // line instead of only in the generic error slot, which the hourly
        // panel never shows.
        dispatch({ type: "SET_FORECAST_UNAVAILABLE", error: message });
      } finally {
        if (requestId === latestForecastRequestRef.current) {
          dispatch({ type: "SET_LOADING", loading: false });
        }
      }
    },
    [state.cloudState.model, state.forecastCache],
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
      const locationId = stableSampleLocationId(latitude, longitude);
      const requestStartedAt = Date.now();
      const lastAttempt = lastForecastAttemptRef.current;
      const resolvedElevation =
        elevation > 0
          ? elevation
          : resolveElevation(latitude, longitude, name, elevation);
      const location: Location = {
        id: locationId,
        name: name ?? "取样点",
        latitude,
        longitude,
        elevation: resolvedElevation,
        source: name ? "搜索" : "自定义",
      };

      selectedLocationIdRef.current = location.id;
      dispatch({ type: "SET_LOCATION", location });
      dispatch({ type: "SET_DETAIL_OPEN", open: true });
      // Re-requesting the same point inside the cooldown window would only
      // re-hit a rate-limited upstream, so keep the UI responsive (the panel
      // reopens, existing data stays) without issuing another request.
      if (
        lastAttempt &&
        lastAttempt.key === locationId &&
        requestStartedAt - lastAttempt.at < FORECAST_SAMPLE_COOLDOWN_MS
      ) {
        return;
      }
      lastForecastAttemptRef.current = { key: locationId, at: requestStartedAt };
      // Same contract as selectLocation: an explicit request owns this
      // location+model pair, so the hydration effect must not retry it and
      // mask a 429 the user is supposed to see.
      forecastHydrationKeyRef.current = `${locationId}|${selectedModel}`;
      const cached = state.forecastCache.get(locationId);
      const requestId = ++latestForecastRequestRef.current;
      forecastInFlightRef.current = true;
      dispatch({ type: "SET_LOADING", loading: true });
      dispatch({ type: "SET_SAMPLE", sample: null });
      if (cached) {
        dispatch({ type: "SET_FORECAST", forecast: cached });
      } else {
        dispatch({ type: "SET_FORECAST", forecast: null });
      }
      try {
        const [sample, forecast] = await Promise.all([
          sampleBortle(latitude, longitude),
          fetchForecastFor(location, selectedModel),
        ]);
        if (requestId !== latestForecastRequestRef.current) return;
        dispatch({ type: "SET_SAMPLE", sample });
        dispatch({ type: "SET_FORECAST", forecast });
        // The plan asks for an explicit "last successful update" timestamp.
        // Use the upstream-provided `fetchedAt` when present; otherwise fall
        // back to the moment the response arrived at the client. We never
        // fabricate upstream time, but we also don't leave the success
        // surface empty when the API omits the field.
        dispatch({
          type: "SET_FORECAST_SUCCESS",
          fetchedAt: forecast?.fetchedAt ?? new Date().toISOString(),
        });
        if (forecast) {
          dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
        }
      } catch (error) {
        if (requestId !== latestForecastRequestRef.current) return;
        const message = error instanceof Error ? error.message : "取样或天气请求失败";
        const fallback = state.forecastCache.get(locationId);
        if (fallback) {
          dispatch({ type: "SET_FORECAST", forecast: fallback });
        }
        dispatch({ type: "SET_ERROR", error: message });
        dispatch({ type: "SET_FORECAST_UNAVAILABLE", error: message });
      } finally {
        if (requestId === latestForecastRequestRef.current) {
          dispatch({ type: "SET_LOADING", loading: false });
        }
        forecastInFlightRef.current = false;
      }
    },
    [state.cloudState.model, state.forecastCache],
  );

  const refreshData = useCallback(async () => {
    const location = state.selectedLocation;
    const requestStartedAt = Date.now();
    const lastAttempt = lastForecastAttemptRef.current;
    // A forced refresh bypasses the HTTP cache and hits the upstream directly,
    // so stacked clicks inside the cooldown window must not both go out. The
    // cooldown only gates the location-bound forecast request; the revision
    // below still fires so satellite/cloud/status layers can refresh.
    if (
      location &&
      lastAttempt &&
      lastAttempt.key === location.id &&
      requestStartedAt - lastAttempt.at < FORECAST_SAMPLE_COOLDOWN_MS
    ) {
      return;
    }
    // Publish the revision even without a selected location: the satellite
    // catalogue, cloud grid and data-source status are location-independent,
    // and the refresh button promises all of them ("刷新天气、卫星目录和数据源状态").
    // Previously the early return above skipped this dispatch, so the manual
    // refresh was a silent no-op for those layers.
    const revision = Date.now();
    dispatch({ type: "REFRESH_DATA", revision });
    dispatch({ type: "SET_ERROR", error: "" });
    if (!location) return;
    lastForecastAttemptRef.current = { key: location.id, at: requestStartedAt };
    const requestId = ++latestForecastRequestRef.current;
    forecastInFlightRef.current = true;
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
      dispatch({
        type: "SET_FORECAST_SUCCESS",
        fetchedAt: forecast?.fetchedAt ?? new Date().toISOString(),
      });
      if (forecast) {
        dispatch({ type: "CACHE_FORECAST", locationId: location.id, forecast });
      }
    } catch (error) {
      if (requestId !== latestForecastRequestRef.current) return;
      const message = error instanceof Error ? error.message : "数据刷新失败";
      dispatch({ type: "SET_ERROR", error: message });
      dispatch({ type: "SET_FORECAST_UNAVAILABLE", error: message });
    } finally {
      if (requestId === latestForecastRequestRef.current) {
        dispatch({ type: "SET_LOADING", loading: false });
      }
      forecastInFlightRef.current = false;
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
          elevation: location.elevation ?? null,
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
        // A hydrated forecast is real data too, so it must publish its
        // freshness; otherwise the availability line stayed blank for any
        // location that was restored without an explicit request.
        dispatch({
          type: "SET_FORECAST_SUCCESS",
          fetchedAt: forecast.fetchedAt ?? new Date().toISOString(),
        });
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

  // Quiet periodic recheck: only while a location is selected, the tab is
  // visible, and no request is already in flight. The latest-request guard
  // shared with sampleAt/refreshData drops late responses after switches.
  const selectedLocationId = state.selectedLocation?.id ?? null;
  const selectedLatitude = state.selectedLocation?.latitude;
  const selectedLongitude = state.selectedLocation?.longitude;
  const selectedElevation = state.selectedLocation?.elevation;
  const selectedName = state.selectedLocation?.name;
  useEffect(() => {
    if (!selectedLocationId) return;
    const RECHECK_INTERVAL_MS = 5 * 60_000;
    let cancelled = false;
    const recheck = () => {
      if (cancelled || document.hidden) return;
      if (forecastInFlightRef.current) return;
      const requestId = ++latestForecastRequestRef.current;
      forecastInFlightRef.current = true;
      const location: Location = {
        id: selectedLocationId,
        name: selectedName ?? "取样点",
        latitude: selectedLatitude ?? 0,
        longitude: selectedLongitude ?? 0,
        elevation: selectedElevation ?? 0,
        source: "自定义",
      };
      void fetchForecastFor(location, state.cloudState.model)
        .then((forecast) => {
          forecastInFlightRef.current = false;
          if (
            cancelled ||
            requestId !== latestForecastRequestRef.current ||
            selectedLocationIdRef.current !== selectedLocationId
          ) {
            return;
          }
          if (!forecast) return;
          dispatch({ type: "SET_FORECAST", forecast });
          dispatch({
            type: "SET_FORECAST_SUCCESS",
            fetchedAt: forecast.fetchedAt ?? null,
          });
          dispatch({ type: "CACHE_FORECAST", locationId: selectedLocationId, forecast });
        })
        .catch(() => {
          forecastInFlightRef.current = false;
          // A failed quiet recheck keeps the last availability state visible.
        });
    };
    const timer = setInterval(recheck, RECHECK_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) recheck();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [
    selectedElevation,
    selectedLatitude,
    selectedLocationId,
    selectedLongitude,
    selectedName,
    state.cloudState.model,
  ]);

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
  const setMapWorkspace = useCallback((workspace: MapWorkspace) => {
    dispatch({ type: "SET_MAP_WORKSPACE", workspace });
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
      localStorage.setItem(
        OBSERVING_BORTLE_LEVELS_STORAGE_KEY,
        JSON.stringify(bortleLevelsForLimit(limit)),
      );
    } catch {
      // Optional preference.
    }
  }, []);
  const setObservingBortleLevels = useCallback((levels: BortleLevel[]) => {
    const next = normalizeBortleLevels(levels);
    dispatch({ type: "SET_OBSERVING_BORTLE_LEVELS", levels: next });
    try {
      localStorage.setItem(
        OBSERVING_BORTLE_LEVELS_STORAGE_KEY,
        JSON.stringify(next),
      );
      localStorage.setItem(
        OBSERVING_BORTLE_LIMIT_STORAGE_KEY,
        String(next.includes(4) ? 4 : 3),
      );
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
      setMapWorkspace,
      setForecastTheme,
      setRecommendationThreshold,
      setObservingBortleLevels,
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
      setMapWorkspace,
      setForecastTheme,
      setRecommendationThreshold,
      setObservingBortleLevels,
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
