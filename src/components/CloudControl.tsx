"use client";

import { Cloud } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useStore } from "@/lib/store";
import { getCloudCoverAtTime, getValuesAtTime, averageLayer } from "@/lib/cloudGrid";
import { hasDarkSkyLayer } from "@/lib/assets";
import { isInNight } from "@/lib/nighttime";
import type { CloudDisplayMode } from "@/lib/types";

const MODELS: { id: "icon" | "gfs" | "aifs"; label: string }[] = [
  { id: "icon", label: "ICON" },
  { id: "gfs", label: "GFS" },
  { id: "aifs", label: "AIFS" },
];

const CLOUD_MODES: Array<{ id: CloudDisplayMode; label: string; color: string }> = [
  { id: "total", label: "总云量", color: "--green" },
  { id: "high", label: "高云", color: "--green" },
  { id: "mid", label: "中云", color: "--amber" },
  { id: "low", label: "低云", color: "--cloud-low" },
];

export default function CloudControl() {
  const { state, setCloud, setMapViewMode } = useStore();
  const { cloudState, selectedNight, forecast, cloudGrid } = state;
  const [buildInfo, setBuildInfo] = useState<{ version?: string; buildRevision?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/healthz", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (data) setBuildInfo(data); })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const time = cloudState.activeForecastTime ?? cloudState.timeIndex;
  let values: Record<CloudDisplayMode, number | null> = { total: null, high: null, mid: null, low: null };
  let valueSource = "暂无有效云量数据";
  const forecastMatchesModel = forecast?.metadata?.model === cloudState.model;

  // The control panel, timeline card and matrix all describe the selected
  // point. The canvas may still use the surrounding grid for spatial context,
  // but the numbers must not silently switch to a regional average.
  if (cloudState.overlayMode === "forecast-cloud" && forecastMatchesModel && forecast) {
    const hour = typeof time === "string"
      ? forecast.hourly.find((item) => item.time === time)
      : forecast.hourly.filter((item) => isInNight(item.time, selectedNight))[time];
    values = {
      total: hour?.cloudCover ?? null,
      high: hour?.cloudHigh ?? null,
      mid: hour?.cloudMid ?? null,
      low: hour?.cloudLow ?? null,
    };
    valueSource = "取样点 · Open-Meteo";
  } else if (cloudState.overlayMode === "forecast-cloud" && cloudGrid?.model === cloudState.model) {
    const layers = getValuesAtTime(cloudGrid, time);
    values = {
      total: averageLayer(getCloudCoverAtTime(cloudGrid, time)),
      high: averageLayer(layers.high),
      mid: averageLayer(layers.mid),
      low: averageLayer(layers.low),
    };
    valueSource = "地图采样网格平均 · Open-Meteo";
  }

  const selectedMode = CLOUD_MODES.find((mode) => mode.id === cloudState.cloudDisplayMode) ?? CLOUD_MODES[0];
  const selectedValue = values[selectedMode.id];

  return (
    <div className="cloud-control compact" data-testid="cloud-control">
      <div className="cloud-control-head">
          <b>{cloudState.overlayMode === "satellite-cloud" ? "卫星云观测" : cloudState.overlayMode === "night-lights" ? "卫星夜光" : "云量预报"}</b>
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
      <div className="source-status-panel" aria-label="数据源状态">
        <span className="source-status-title">数据源状态</span>
        <span><i className="source-dot available" />天气 / Open-Meteo <b>可用</b></span>
        <span><i className="source-dot available" />卫星图层 / NASA GIBS <b>切换时探测</b></span>
        <span><i className={`source-dot ${process.env.NEXT_PUBLIC_TIANDITU_TOKEN ? "available" : "unconfigured"}`} />天地图 Token <b>{process.env.NEXT_PUBLIC_TIANDITU_TOKEN ? "可用" : "未配置"}</b></span>
        <span><i className={`source-dot ${hasDarkSkyLayer() ? "available" : "not-installed"}`} />Bortle / SQM <b>{hasDarkSkyLayer() ? "可用" : "未安装"}</b></span>
        <span><i className="source-dot available" />构建 <b>{buildInfo ? `${buildInfo.version ?? "—"} · ${buildInfo.buildRevision ?? "local"}` : "读取中"}</b></span>
      </div>
      <details className="source-status-help">
        <summary>配置说明</summary>
        <ul>
          <li><strong>天气 / Open-Meteo：</strong>已配置，无需 API Key。</li>
          <li><strong>卫星 / NASA GIBS：</strong>已配置，使用 Himawari 和 Black Marble 公共图层。</li>
          <li><strong>天地图 Token：</strong>可选；复制 `.env.example` 为 `.env.local`，填写 `NEXT_PUBLIC_TIANDITU_TOKEN` 后重启服务。</li>
          <li><strong>Bortle / SQM：</strong>当前未安装合法本地栅格；需要先取得授权资源，再按 `NEXT_PUBLIC_ASSET_VIIRS_TILES` 或 `NEXT_PUBLIC_ASSET_WORLD_ATLAS` 开启。</li>
        </ul>
      </details>

      <div className={`cloud-body${cloudState.enabled ? "" : " disabled"}`}>
        <div className="cloud-field">
          <label>图层模式</label>
          <div className="cloud-tabs" role="tablist" aria-label="云图与卫星图层">
            {[{ id: "satellite-cloud", label: "卫星云图", map: "satellite" as const }, { id: "forecast-cloud", label: "综合决策", map: "combined" as const }, { id: "night-lights", label: "光污染", map: "light-pollution" as const }].map((layer) => (
              <button key={layer.id} type="button" role="tab" aria-selected={cloudState.overlayMode === layer.id} className={cloudState.overlayMode === layer.id ? "active" : ""} onClick={() => { setMapViewMode(layer.map); setCloud({ overlayMode: layer.id as "forecast-cloud" | "satellite-cloud" | "night-lights", playing: false }); }}>{layer.label}</button>
            ))}
          </div>
          {cloudState.overlayMode === "satellite-cloud" && <small className="cloud-source-note">NASA GIBS · Himawari AHI Band 13 · 观测时次</small>}
          {cloudState.overlayMode === "night-lights" && <small className="cloud-source-note">NASA GIBS · VIIRS Black Marble · 2016 夜光基准</small>}
        </div>

        {cloudState.overlayMode === "forecast-cloud" && <div className="cloud-field">
          <label>预报模型</label>
          <div className="cloud-tabs">
            {MODELS.map((model) => (
              <button key={model.id} type="button" className={cloudState.model === model.id ? "active" : ""} onClick={() => setCloud({ model: model.id })}>{model.label}</button>
            ))}
          </div>
        </div>}

        {cloudState.overlayMode === "forecast-cloud" && <div className="cloud-field cloud-layers">
          <label>云量通道（单选）</label>
          <div className="cloud-mode-tabs" role="tablist" aria-label="数值云量通道">
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
                <b>{values[mode.id] == null ? "—" : `${Math.round(values[mode.id] as number)}%`}</b>
              </button>
            ))}
          </div>
          <div className="cloud-channel-readout" style={{ "--channel-color": `var(${selectedMode.color})` } as CSSProperties}>
            <span>{selectedMode.label}</span>
            <strong>{selectedValue == null ? "—" : `${Math.round(selectedValue)}%`}</strong>
          </div>
          <small className="cloud-channel-note">
            数字表示当前预报时次的{selectedMode.label}天空覆盖百分比；{valueSource} · {cloudState.model.toUpperCase()} · {typeof time === "string" ? time.replace("T", " ") : "当前夜间时次"}
          </small>
          <div className="cloud-legend" aria-label="云量预报色阶，0 到 100 百分比">
            <div className="cloud-legend-bar"><i aria-hidden="true" /></div>
            <div className="cloud-legend-ticks">{[0, 20, 40, 60, 80, 100].map((tick) => <span key={tick}>{tick}%</span>)}</div>
          </div>
          <div className="cloud-layer-toggles" role="group" aria-label="预报叠加层">
            <button type="button" aria-pressed={cloudState.windEnabled} className={cloudState.windEnabled ? "active" : ""} onClick={() => setCloud({ windEnabled: !cloudState.windEnabled })}>风场预报</button>
            <button type="button" aria-pressed={cloudState.precipitationEnabled} className={cloudState.precipitationEnabled ? "active" : ""} onClick={() => setCloud({ precipitationEnabled: !cloudState.precipitationEnabled })}>降水预报</button>
          </div>
        </div>}
      </div>
    </div>
  );
}
