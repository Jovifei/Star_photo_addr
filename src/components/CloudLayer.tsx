"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Rectangle, useMap, useMapEvents } from "react-leaflet";
import { useStore } from "@/lib/store";
import {
  forecastDaysForRange,
  generateGridBounds,
  fetchCloudGrid,
} from "@/lib/cloudGrid";
import { nightRangeKeys } from "@/lib/nighttime";
import CloudCanvasOverlay from "@/components/CloudCanvasOverlay";

function describeCloudError(error: unknown): string {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return "本地天气接口不可达，请确认服务已启动后刷新";
  }
  if (error instanceof Error && error.message) return error.message;
  return "天气网格接口返回异常";
}

export default function CloudLayer() {
  const { state, setCloudGrid, setCloudGridLoading } = useStore();
  const {
    cloudState,
    selectedNight,
    cloudGrid,
    dataRefreshRevision,
  } = state;
  const map = useMap();
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const gridSigRef = useRef<string | null>(null);

  const performSampling = useCallback(
    async (forceRefresh = false) => {
      if (
        !map ||
        !selectedNight ||
        cloudState.overlayMode !== "forecast-cloud"
      ) {
        return;
      }
      const { samples, rows, cols } = generateGridBounds(
        map.getBounds(),
        5,
        6,
      );
      const nights = nightRangeKeys(selectedNight, cloudState.range);
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      setCloudGridLoading(true);
      setCloudGrid(null);
      setError(null);
      try {
        const data = await fetchCloudGrid(
          samples,
          nights,
          forecastDaysForRange(
            selectedNight,
            cloudState.range,
            new Date(),
            cloudState.model,
          ),
          cloudState.model,
          rows,
          cols,
          controller.signal,
          forceRefresh,
        );
        if (controller.signal.aborted) return;
        gridSigRef.current = `${selectedNight}|${cloudState.range}|${cloudState.model}|${dataRefreshRevision}`;
        setCloudGrid(data);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(describeCloudError(caught));
        setCloudGrid(null);
      } finally {
        if (requestRef.current === controller) {
          setCloudGridLoading(false);
        }
      }
    },
    [
      cloudState.model,
      cloudState.overlayMode,
      cloudState.range,
      dataRefreshRevision,
      map,
      selectedNight,
      setCloudGrid,
      setCloudGridLoading,
    ],
  );

  useEffect(() => {
    if (
      !cloudState.enabled ||
      cloudState.overlayMode !== "forecast-cloud" ||
      !map ||
      !selectedNight
    ) {
      requestRef.current?.abort();
      gridSigRef.current = null;
      return;
    }
    const signature = `${selectedNight}|${cloudState.range}|${cloudState.model}|${dataRefreshRevision}`;
    if (cloudGrid && gridSigRef.current === signature) return;
    void performSampling(dataRefreshRevision > 0);
  }, [
    cloudGrid,
    cloudState.enabled,
    cloudState.model,
    cloudState.overlayMode,
    cloudState.range,
    dataRefreshRevision,
    map,
    performSampling,
    selectedNight,
  ]);

  useMapEvents({
    moveend() {
      if (
        !cloudState.enabled ||
        cloudState.overlayMode !== "forecast-cloud"
      ) {
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void performSampling(false);
      }, 700);
    },
    zoomend() {
      if (
        !cloudState.enabled ||
        cloudState.overlayMode !== "forecast-cloud"
      ) {
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void performSampling(false);
      }, 700);
    },
  });

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      requestRef.current?.abort();
    },
    [],
  );

  if (
    !cloudState.enabled ||
    cloudState.overlayMode !== "forecast-cloud"
  ) {
    return null;
  }

  const bounds = cloudGrid
    ? ([
        [cloudGrid.bounds.south, cloudGrid.bounds.west],
        [cloudGrid.bounds.north, cloudGrid.bounds.east],
      ] as [[number, number], [number, number]])
    : null;

  return (
    <>
      {cloudGrid && (
        <CloudCanvasOverlay
          gridData={cloudGrid}
          timeIndex={cloudState.timeIndex}
          activeForecastTime={cloudState.activeForecastTime}
          displayMode={cloudState.cloudDisplayMode}
          showPrecipitation={cloudState.precipitationEnabled}
          showWind={cloudState.windEnabled}
        />
      )}
      {bounds && (
        <Rectangle
          bounds={bounds}
          pathOptions={{
            color: "#91a4ab",
            weight: 1,
            dashArray: "6 4",
            fill: false,
            opacity: 0.5,
          }}
        />
      )}
      {error && !cloudGrid && (
        <div className="cloud-overlay-error" role="status">
          <span>云图加载失败：{error}</span>
          <button type="button" onClick={() => void performSampling(true)}>
            强制重试
          </button>
        </div>
      )}
    </>
  );
}
