"use client";

import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Cloud, Moon, Mountain, AlertTriangle, Loader2 } from "lucide-react";
import type { HourEvaluation, Location } from "@/lib/types";
import { deriveCloudLayers } from "@/features/planner/lib/clouds";

const ReactECharts = lazy(() => import("echarts-for-react"));

interface LocationDetailChartsProps {
  evaluation: {
    hours: HourEvaluation[];
    window?: HourEvaluation[];
    score?: number;
  } | null;
  location: Location | null;
  nightKey: string;
  activeHour?: string | null;
  onSelectHour?: (time: string) => void;
  model?: string;
}

interface PressureLevel {
  pressure: number;
  heightMsl: number;
  cloudCover: number;
  humidity?: number;
}

interface PressureForecastResult {
  modelElevation: number;
  profiles: Record<string, PressureLevel[]>;
}

function formatHour(timeString?: string | null): string {
  if (!timeString || timeString.length < 16) return "";
  return timeString.slice(11, 16);
}

function baseChartStyle() {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#8da4ad", fontFamily: "var(--font-sans, system-ui, sans-serif)" },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(6, 17, 24, 0.92)",
      borderColor: "rgba(165, 205, 216, 0.25)",
      textStyle: { color: "#f1f5f9", fontSize: 11 },
    },
    grid: { left: 36, right: 14, top: 32, bottom: 26 },
  };
}

function buildWeatherChart(hours: HourEvaluation[]) {
  const base = baseChartStyle();
  return {
    ...base,
    legend: {
      top: 2,
      textStyle: { color: "#8da4ad", fontSize: 10 },
      itemWidth: 10,
      itemHeight: 8,
      data: ["总云", "低云", "降水", "风速"],
    },
    xAxis: {
      type: "category",
      data: hours.map((h) => formatHour(h.time)),
      axisLine: { lineStyle: { color: "rgba(165, 205, 216, 0.18)" } },
      axisLabel: { color: "#7a939d", fontSize: 9, interval: 0 },
    },
    yAxis: [
      {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { color: "#7a939d", fontSize: 9, formatter: "{value}%" },
        splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)" } },
      },
      {
        type: "value",
        axisLabel: { color: "#7a939d", fontSize: 9, formatter: "{value}m/s" },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: "总云",
        type: "line",
        smooth: true,
        data: hours.map((h) => h.cloudCover ?? 0),
        lineStyle: { color: "#d5e1f0", width: 2 },
        itemStyle: { color: "#d5e1f0" },
        areaStyle: { color: "rgba(213, 225, 240, 0.08)" },
      },
      {
        name: "低云",
        type: "line",
        smooth: true,
        data: hours.map((h) => h.cloudLow ?? 0),
        lineStyle: { color: "#38bdf8", width: 2 },
        itemStyle: { color: "#38bdf8" },
      },
      {
        name: "降水",
        type: "bar",
        data: hours.map((h) => h.precipitationProbability ?? 0),
        itemStyle: { color: "rgba(59, 130, 246, 0.45)", borderRadius: [3, 3, 0, 0] },
      },
      {
        name: "风速",
        type: "line",
        yAxisIndex: 1,
        data: hours.map((h) => h.windSpeed ?? 0),
        lineStyle: { color: "#f59e0b", type: "dashed", width: 1.5 },
        itemStyle: { color: "#f59e0b" },
      },
    ],
  };
}

function buildAstroChart(hours: HourEvaluation[]) {
  const base = baseChartStyle();
  return {
    ...base,
    legend: {
      top: 2,
      textStyle: { color: "#8da4ad", fontSize: 10 },
      itemWidth: 10,
      itemHeight: 8,
      data: ["太阳", "月亮", "银河核心"],
    },
    xAxis: {
      type: "category",
      data: hours.map((h) => formatHour(h.time)),
      axisLine: { lineStyle: { color: "rgba(165, 205, 216, 0.18)" } },
      axisLabel: { color: "#7a939d", fontSize: 9, interval: 0 },
    },
    yAxis: {
      type: "value",
      min: -40,
      max: 90,
      axisLabel: { color: "#7a939d", fontSize: 9, formatter: "{value}°" },
      splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)" } },
    },
    series: [
      {
        name: "太阳",
        type: "line",
        smooth: true,
        data: hours.map((h) => Math.round(h.sunAltitude ?? 0)),
        lineStyle: { color: "#f59e0b", width: 2 },
        itemStyle: { color: "#f59e0b" },
        markLine: {
          symbol: "none",
          label: { formatter: "-18° 天文暗夜", color: "#64748b", fontSize: 9, position: "insideEndTop" },
          lineStyle: { color: "rgba(100, 116, 139, 0.5)", type: "dashed" },
          data: [{ yAxis: -18 }],
        },
      },
      {
        name: "月亮",
        type: "line",
        smooth: true,
        data: hours.map((h) => Math.round(h.moonAltitude ?? 0)),
        lineStyle: { color: "#cbd5e1", width: 1.8 },
        itemStyle: { color: "#cbd5e1" },
      },
      {
        name: "银河核心",
        type: "line",
        smooth: true,
        data: hours.map((h) => Math.round(h.galacticAltitude ?? 0)),
        lineStyle: { color: "#38bdf8", width: 2.5 },
        itemStyle: { color: "#38bdf8" },
      },
    ],
  };
}

function buildProfileChart(profile: PressureLevel[], siteElevation: number) {
  const valid = profile.filter((l) => Number.isFinite(l.heightMsl));
  const base = baseChartStyle();
  return {
    ...base,
    grid: { left: 48, right: 14, top: 18, bottom: 26 },
    xAxis: {
      type: "value",
      min: 0,
      max: 100,
      axisLabel: { color: "#7a939d", fontSize: 9, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)" } },
    },
    yAxis: {
      type: "value",
      name: "m (海拔)",
      nameTextStyle: { color: "#7a939d", fontSize: 9 },
      axisLabel: { color: "#7a939d", fontSize: 9 },
      splitLine: { lineStyle: { color: "rgba(255, 255, 255, 0.05)" } },
    },
    series: [
      {
        name: "气压层云量",
        type: "line",
        data: valid.map((l) => [l.cloudCover ?? 0, l.heightMsl]),
        lineStyle: { color: "#38bdf8", width: 2.5 },
        itemStyle: { color: "#38bdf8" },
        areaStyle: { color: "rgba(56, 189, 248, 0.12)" },
        markLine: {
          symbol: "none",
          label: { formatter: `点位 ${siteElevation}m`, color: "#f59e0b", fontSize: 9 },
          lineStyle: { color: "#f59e0b", type: "dashed" },
          data: [{ yAxis: siteElevation }],
        },
      },
    ],
  };
}

export default function LocationDetailCharts({
  evaluation,
  location,
  activeHour,
  onSelectHour,
  model = "icon",
}: LocationDetailChartsProps) {
  const hours = useMemo(() => evaluation?.hours ?? [], [evaluation?.hours]);
  const siteElevation = Math.round(location?.elevation ?? 0);

  const [pressure, setPressure] = useState<PressureForecastResult | null>(null);
  const [pressureLoading, setPressureLoading] = useState(false);
  const [pressureError, setPressureError] = useState<string | null>(null);

  // Fetch vertical atmospheric profile
  useEffect(() => {
    if (!location) return;
    const controller = new AbortController();
    let isMounted = true;

    queueMicrotask(() => {
      if (isMounted) {
        setPressureLoading(true);
        setPressureError(null);
      }
    });

    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      days: "7",
      model,
    });

    fetch(`/api/pressure-forecast?${params}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then((res) => {
        if (!res.ok) throw new Error("气压剖面获取失败");
        return res.json();
      })
      .then((data: PressureForecastResult) => {
        setPressure(data);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        setPressureError("垂直云层暂时不可用");
      })
      .finally(() => {
        setPressureLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [location, model]);

  // Determine active hour
  const effectiveHour = activeHour ?? hours[0]?.time ?? null;

  const profile = useMemo(() => {
    if (!pressure?.profiles || !effectiveHour) return [];
    return pressure.profiles[effectiveHour] ?? [];
  }, [pressure, effectiveHour]);

  const layers = useMemo(() => {
    if (!pressure || !profile.length) return [];
    return deriveCloudLayers(profile, pressure.modelElevation, siteElevation);
  }, [pressure, profile, siteElevation]);

  const weatherOption = useMemo(() => {
    if (!hours.length) return null;
    return buildWeatherChart(hours);
  }, [hours]);

  const astroOption = useMemo(() => {
    if (!hours.length) return null;
    return buildAstroChart(hours);
  }, [hours]);

  const profileOption = useMemo(() => {
    if (!profile.length) return null;
    return buildProfileChart(profile, siteElevation);
  }, [profile, siteElevation]);

  if (!hours.length) return null;

  return (
    <div className="location-detail-charts">
      {/* 1. Hourly Weather & Cloud Trend Chart */}
      <section className="detail-chart-card">
        <div className="detail-chart-card-header">
          <div className="detail-chart-title-box">
            <Cloud size={14} className="chart-icon" />
            <span className="detail-chart-title">逐小时天气走势</span>
          </div>
          <span className="detail-chart-subtitle">总云量 / 低云 / 降水 / 风速</span>
        </div>
        {weatherOption && (
          <div className="chart-wrapper">
            <Suspense fallback={<div className="chart-loading-box">图表加载中…</div>}>
              <ReactECharts option={weatherOption} style={{ height: 180, width: "100%" }} notMerge lazyUpdate />
            </Suspense>
          </div>
        )}

        {/* Quick Hour Selector Chips */}
        {onSelectHour && (
          <div className="detail-hour-chips">
            {hours.map((h) => {
              const isSelected = effectiveHour === h.time;
              return (
                <button
                  key={h.time}
                  type="button"
                  className={`detail-hour-chip ${isSelected ? "detail-hour-chip--active" : ""}`}
                  onClick={() => onSelectHour(h.time)}
                  title={`${formatHour(h.time)} · 综合 ${h.score}分`}
                >
                  <span className="detail-hour-chip-time">{formatHour(h.time)}</span>
                  <span className="detail-hour-chip-score">{h.score}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 2. Astronomy Trajectory Chart */}
      <section className="detail-chart-card">
        <div className="detail-chart-card-header">
          <div className="detail-chart-title-box">
            <Moon size={14} className="chart-icon" />
            <span className="detail-chart-title">天文轨迹曲线</span>
          </div>
          <span className="detail-chart-subtitle">太阳 / 月亮 / 银河核心高度角</span>
        </div>
        {astroOption && (
          <div className="chart-wrapper">
            <Suspense fallback={<div className="chart-loading-box">图表加载中…</div>}>
              <ReactECharts option={astroOption} style={{ height: 170, width: "100%" }} notMerge lazyUpdate />
            </Suspense>
          </div>
        )}
      </section>

      {/* 3. Low Cloud Altitude & Elevation Profile */}
      <section className="detail-chart-card">
        <div className="detail-chart-card-header">
          <div className="detail-chart-title-box">
            <Mountain size={14} className="chart-icon" />
            <span className="detail-chart-title">低云垂直剖面与海拔</span>
          </div>
          <span className="detail-chart-subtitle">
            {effectiveHour ? `${formatHour(effectiveHour)} 时次推导` : "气压层推导"}
          </span>
        </div>

        {pressureLoading && (
          <div className="chart-loading-box">
            <Loader2 size={14} className="spin" />
            <span>推导垂直云层剖面…</span>
          </div>
        )}

        {pressureError && (
          <div className="chart-error-box">
            <AlertTriangle size={13} />
            <span>{pressureError}</span>
          </div>
        )}

        {!pressureLoading && profileOption && (
          <div className="chart-wrapper">
            <Suspense fallback={<div className="chart-loading-box">图表加载中…</div>}>
              <ReactECharts option={profileOption} style={{ height: 160, width: "100%" }} notMerge lazyUpdate />
            </Suspense>
          </div>
        )}

        {/* Cloud Layers Relation Tags */}
        {!pressureLoading && layers.length > 0 && (
          <div className="cloud-layers-chips">
            {layers.map((layer, idx) => {
              const relationTone =
                layer.relation === "云上" ? "tone-good" : layer.relation === "云中" ? "tone-bad" : "tone-warn";
              return (
                <div key={idx} className="cloud-layer-badge">
                  <span className="layer-range">
                    {layer.baseMsl}–{layer.topMsl}m
                  </span>
                  <span className={`layer-status ${relationTone}`}>{layer.relation}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
