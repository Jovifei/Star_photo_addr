"use client";

import { useCallback, useState } from "react";

interface GeolocationState {
  loading: boolean;
  error: string;
  latitude: number | null;
  longitude: number | null;
}

/** Wraps navigator.geolocation. Calls `onLocated` with the resolved coords. */
export function useGeolocation(
  onLocated: (latitude: number, longitude: number) => void,
) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: "",
    latitude: null,
    longitude: null,
  });

  const locate = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setState((prev) => ({ ...prev, error: "当前浏览器不支持定位" }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setState({ loading: false, error: "", latitude, longitude });
        onLocated(latitude, longitude);
      },
      (positionError) => {
        setState({
          loading: false,
          error:
            positionError.code === 1
              ? "定位权限被拒绝"
              : "无法获取当前位置",
          latitude: null,
          longitude: null,
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [onLocated]);

  return { ...state, locate };
}
