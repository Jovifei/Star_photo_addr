"use client";

import { Cloud, RefreshCw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useStore } from "@/lib/store";
import {
  getCloudCoverAtTime,
  getValuesAtTime,
  averageLayer,
} from "@/lib/cloudGrid";
import { isInNight } from "@/lib/nighttime";
import {
  dataSourceStatusLabel,
  type DataSourceHealthResponse,
  type DataSourceProbe,
} from "@/lib/dataSourceStatus";
import type { CloudDisplayMode } from "@/lib/types";

const MODELS: { id: "icon" | "gfs" | "aifs"; label: string }[] = [
  { id: "icon", label: "ICON" },
  { id: "gfs", label: "GFS" },
  { id: "aifs", label: "AIFS" },
];

const CLOUD_MODES: Array<{
  id: CloudDisplayMode;
  label: string;
  color: string;
}> = [
  { id: "total", label: "总云量", color: "--green" },
  { id: "high", label: "高云", color: "--green" },
  { id: "mid", label: "中云", color: "--amber" },
  { id: "low", label: "低云", color: "--cloud-low" },
];

function statusClass(source?: DataSourceProbe): string {
  return source?.status ?? "degraded";
}

function SourceStatusRow({ source }: { source?: DataSourceProbe }) {
  return (
    <span title={source?.detail}>
      <i className={`source-dot ${statusClass(source)}`} />
      {source?.label ?? "数据源"}
      <b>{source ? dataSourceStatusLabel(source.status) : "检测中"}</b>
    </span>
  );
}

function healthModeLabel(health: DataSourceHealthResponse): string {
  if (health.refreshSuppressed) return "刷新冷却";
  if (health.coalesced) return "合并检测";
  return health.cached ? "缓存检测" : "实时检测";
}

export default function CloudControl() {
  const { state, setCloud, refreshData } = useStore();
  const { cloudState, selectedNight, forecast, cloudGrid } = state;
  const [buildInfo, setBuildInfo] = useState<{
    version?: string;
    buildRevision?: string;
  } | null>(null);
  const [health, setHealth] = useState<DataSourceHealthResponse | null>(null);
  const [healthError, setHealthError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const healthRequestRef = useRef<AbortController | null>(null);

  const loadHealth = useCallback(async (force = false) => {
    healthRequestRef.current?.abort();
    const controller = new AbortController();
    healthRequestRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20_000);
    try {
      const response = await fetch(
        `/api/data-status${force ? "?refresh=1" : ""}`,
        {
          cache: force ? "no-store" : "default",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data) {
        throw new Error(
          data?.error ?? `数据源检测失败 (${response.status})`,
        );
      }
      if (
        controller.signal.aborted ||
        healthRequestRef.current !== controller
      ) {
        return;
      }
      setHealth(data as DataSourceHealthResponse);
      setHealthError("");
    } catch (error) {
      if (healthRequestRef.current !== controller) return;
      if (timedOut) {
        setHealthError("数据源检测超时；保留上一次状态");
      } else if (!controller.signal.aborted) {
        setHealthError(
          error instanceof Error ? error.message : "数据源检测失败",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (healthRequestRef.current === controller) {
        healthRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/healthz", { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && !controller.signal.aborted) setBuildInfo(data);
      })
      .catch(() => undefined);
    const initialHealthTimer = window.setTimeout(() => {
      void loadHealth(false);
    }, 0);
    const timer = window.setInterval(
      () => void loadHealth(false),
      5 * 60_000,
    );
    return () => {
      controller.abort();
      healthRequestRef.current?.abort();
      healthRequestRef.current = null;
      window.clearTimeout(initialHealthTimer);
      window.clearInterval(timer);
    };
  }, [loadHealth]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.allSettled([refreshData(), loadHealth(true)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadHealth, refreshData, refreshing]);

  const time = cloudState.activeForecastTime ?? cloudState.timeIndex;
  let values: Record<CloudDisplayMode, number | null> = {
    total: null,
    high: null,
    mid: null,
    low: null,
  };
  let valueSource = "暂无有效云量数据";
  const forecastMatchesModel =
    forecast?.metadata?.model === cloudState.model;

  if (
    cloudState.overlayMode === "forecast-cloud" &&
    forecastMatchesModel &&
    forecast
  ) {
    const hour =
      typeof time === "string"
        ? forecast.hourly.find((item) => item.time === time)
        : forecast.hourly.filter((item) => isInNight(item.time, selectedNight))[
            time
          ];
    values = {
      total: hour?.cloudCover ?? null,
      high: hour?.cloudHigh ?? null,
      mid: hour?.cloudMid ?? null,
      low: hour?.cloudLow ?? null,
    };
    valueSource = "取样点 · Open-Meteo";
  } else if (
    cloudState.overlayMode === "forecast-cloud" &&
    cloudGrid?.model === cloudState.model
  ) {
    const layers = getValuesAtTime(cloudGrid, time);
    values = {
      total: averageLayer(getCloudCoverAtTime(cloudGrid, time)),
      high: averageLayer(layers.high),
      mid: averageLayer(layers.mid),
      low: averageLayer(layers.low),
    };
    valueSource = "地图采样网格平均 · Open-Meteo";
  }

  const selectedMode =
    CLOUD_MODES.find((mode) => mode.id === cloudState.cloudDisplayMode) ??
    CLOUD_MODES[0];
  const selectedValue = values[selectedMode.id];
  const sources = health?.sources;
  const healthSummary = healthError
    ? `最近复检失败：${healthError}`
    : health
      ? `${healthModeLabel(health)} · ${new Date(health.checkedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
      : "检测中";

  return (
    <div className="cloud-control compact" data-testid="cloud-control">
      <div className="cloud-control-head">
        <b>
          {cloudState.overlayMode === "satellite-cloud"
            ? "卫星云观测"
            : cloudState.overlayMode === "night-lights"
              ? "光污染参考"
              : "云量预报"}
        </b>
        <div className="cloud-control-actions">
          <button
            type="button"
            className="cloud-refresh-button"
            onClick={() => void handleRefresh()}
            disabled={refreshing || state.loading}
            aria-label="强制刷新天气、卫星目录和数据源状态"
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={refreshing || state.loading ? "spin" : ""}
            />
            <span>{refreshing || state.loading ? "刷新中" : "刷新数据"}</span>
          </button>
          <button
            type="button"
            className="cloud-master-toggle"
            aria-pressed={cloudState.enabled}
            onClick={() => setCloud({ enabled: !cloudState.enabled })}
          >
            <Cloud size={16} aria-hidden="true" />
            {cloudState.enabled ? "已开启" : "开启"}
          </button>
        </div>
      </div>

      <div className="source-status-panel" aria-label="数据源状态">
        <span className="source-status-title">
          数据源状态
          <small title={health?.nextRefreshAt}>{healthSummary}</small>
        </span>
        <SourceStatusRow source={sources?.weather} />
        <SourceStatusRow source={sources?.satellite} />
        <SourceStatusRow source={sources?.["light-pollution"]} />
        <SourceStatusRow source={sources?.tianditu} />
        <SourceStatusRow source={sources?.["local-dark-sky"]} />
        <span>
          <i className="source-dot available" />构建
          <b>
            {buildInfo
              ? `${buildInfo.version ?? "—"} · ${buildInfo.buildRevision ?? "local"}`
              : "读取中"}
          </b>
        </span>
      </div>

      <details className="source-status-help">
        <summary>数据来源与部署说明</summary>
        <ul>
          <li>
            <strong>天气：</strong>Open-Meteo 数值预报；强制刷新会绕过应用内新鲜缓存，失败时仅回退到明确标记的旧数据。
          </li>
          <li>
            <strong>卫星：</strong>NASA GIBS Himawari AHI Band 13 云图；卫星时次与天气预报使用不同时间域。
          </li>
          <li>
            <strong>光污染：</strong>VIIRS 2023 第三方视觉瓦片，只用于空间参考，不等同于现场 Bortle 或 SQM 实测。
          </li>
          <li>
            <strong>Bortle / SQM：</strong>只有安装并显式启用授权本地栅格后才显示数值；未安装时不会伪造。
          </li>
        </ul>
      </details>

      <div className={`cloud-body${cloudState.enabled ? "" : " disabled"}`}>
        <div className="cloud-field">
          <label>当前图层</label>
          <p className="cloud-active-layer-note">
            {cloudState.overlayMode === "satellite-cloud"
              ? "卫星云图 · NASA GIBS · Himawari AHI Band 13 · 实际观测时次"
              : cloudState.overlayMode === "night-lights"
                ? "光污染 · VIIRS 2023 静态视觉参考 · 第三方 WMTS · 非现场 Bortle/SQM"
                : "云量预报 · 数值模式逐小时外推"}
            <small>切换图层请使用地图顶部的图层条</small>
          </p>
        </div>

        {cloudState.overlayMode === "forecast-cloud" && (
          <div className="cloud-field">
            <label>预报模型</label>
            <div className="cloud-tabs">
              {MODELS.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  className={cloudState.model === model.id ? "active" : ""}
                  onClick={() => setCloud({ model: model.id })}
                >
                  {model.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {cloudState.overlayMode === "forecast-cloud" && (
          <div className="cloud-field cloud-layers">
            <label>云量通道（单选）</label>
            <div
              className="cloud-mode-tabs"
              role="tablist"
              aria-label="数值云量通道"
            >
              {CLOUD_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={selectedMode.id === mode.id}
                  aria-label={`${mode.label}：${values[mode.id] == null ? "暂无数据" : `${Math.round(values[mode.id] as number)}%`}，天空覆盖百分比`}
                  className={selectedMode.id === mode.id ? "active" : ""}
                  onClick={() => setCloud({ cloudDisplayMode: mode.id })}
                >
                  <span>{mode.label}</span>
                  <b>
                    {values[mode.id] == null
                      ? "—"
                      : `${Math.round(values[mode.id] as number)}%`}
                  </b>
                </button>
              ))}
            </div>
            <div
              className="cloud-channel-readout"
              style={
                {
                  "--channel-color": `var(${selectedMode.color})`,
                } as CSSProperties
              }
            >
              <span>{selectedMode.label}</span>
              <strong>
                {selectedValue == null
                  ? "—"
                  : `${Math.round(selectedValue)}%`}
              </strong>
            </div>
            <small className="cloud-channel-note">
              数字表示当前预报时次的{selectedMode.label}天空覆盖百分比；
              {valueSource} · {cloudState.model.toUpperCase()} ·{" "}
              {typeof time === "string"
                ? time.replace("T", " ")
                : "当前夜间时次"}
            </small>
            <div
              className="cloud-legend"
              aria-label="云量预报色阶，0 到 100 百分比"
            >
              <div className="cloud-legend-bar">
                <i aria-hidden="true" />
              </div>
              <div className="cloud-legend-ticks">
                {[0, 20, 40, 60, 80, 100].map((tick) => (
                  <span key={tick}>{tick}%</span>
                ))}
              </div>
            </div>
            <div
              className="cloud-layer-toggles"
              role="group"
              aria-label="预报叠加层"
            >
              <button
                type="button"
                aria-pressed={cloudState.windEnabled}
                className={cloudState.windEnabled ? "active" : ""}
                onClick={() =>
                  setCloud({ windEnabled: !cloudState.windEnabled })
                }
              >
                风场预报
              </button>
              <button
                type="button"
                aria-pressed={cloudState.precipitationEnabled}
                className={cloudState.precipitationEnabled ? "active" : ""}
                onClick={() =>
                  setCloud({
                    precipitationEnabled: !cloudState.precipitationEnabled,
                  })
                }
              >
                降水预报
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
