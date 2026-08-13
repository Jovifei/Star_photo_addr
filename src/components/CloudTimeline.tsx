"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import { useStore } from "@/lib/store";
import { NIGHT_END, NIGHT_START } from "@/lib/constants";
import { formatHourWithDate, formatNightLabel, nightRangeKeys } from "@/lib/nighttime";
import { HOURS_PER_NIGHT } from "@/lib/nighttime";
import { isInNight } from "@/lib/nighttime";
import { aggregateForecastHour, getValuesAtTime } from "@/lib/cloudGrid";
import type { SatelliteFrame } from "@/lib/types";
import HourlyForecastMatrix, { buildNightTimes } from "@/components/HourlyForecastMatrix";
import { evaluateNight } from "@/lib/scoring";

const RANGE_OPTIONS: Array<{ value: 1 | 5 | 7; label: string }> = [
  { value: 1, label: "今晚" },
  { value: 5, label: "5 夜" },
  { value: 7, label: "7 夜" },
];
const PLAY_INTERVAL_MS = 1500;

function buildSchedule(nightKeys: string[]): Array<{ time: string; nightKey: string }> {
  return nightKeys.flatMap((nightKey) =>
    buildNightTimes(nightKey).map((time) => ({ time, nightKey })),
  );
}

function formatTimelineTime(time: string): string {
  if (!time) return "暂无";
  if (time.length === 10) return time;
  // Provider and GIBS timestamps are already wall-clock labels for their
  // respective time domain. Format the string directly instead of reparsing
  // it in the browser's timezone, which could shift an hour or differ on SSR.
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(time);
  if (!match) return time.slice(11, 16);
  const [, , month, day, hour, minute] = match;
  return `${Number(month)}/${Number(day)} ${hour}:${minute}`;
}

function activeForecastTimeLabel(time?: string): string {
  if (!time) return "暂无";
  return time.replace("T", " ");
}

export default function CloudTimeline() {
  const { state, setCloud, selectNight } = useStore();
  const { cloudState, selectedNight, cloudGrid, forecast, selectedLocation } = state;
  const [expanded, setExpanded] = useState(false);
  const [aqiValue, setAqiValue] = useState<number | null>(null);
  const [kpValue, setKpValue] = useState<number | null>(null);
  const nightKeys = useMemo(
    () => nightRangeKeys(selectedNight, cloudState.range),
    [selectedNight, cloudState.range],
  );
  const schedule = useMemo(() => buildSchedule(nightKeys), [nightKeys]);
  const isSatelliteMode = cloudState.overlayMode === "satellite-cloud";
  const isNightLightsMode = cloudState.overlayMode === "night-lights";
  const pointForecast = forecast?.metadata?.model === cloudState.model ? forecast : null;
  const gridForecast = cloudGrid?.model === cloudState.model ? cloudGrid.forecasts[0] ?? null : null;
  const forecastSource = pointForecast
    ? "取样点"
    : gridForecast
      ? "地图采样网格平均"
      : "暂无有效预报";
  const forecastHours = useMemo(
    () => pointForecast?.hourly ?? gridForecast?.hourly ?? [],
    [gridForecast, pointForecast],
  );
  const forecastTimeline = useMemo(
    () => forecastHours.slice(0, 73).map((hour) => ({ time: hour.time, nightKey: selectedNight })),
    [forecastHours, selectedNight],
  );
  const observationTimeline = state.satelliteFrames;
  const timelineItems = useMemo(
    () => isNightLightsMode ? [] : isSatelliteMode ? observationTimeline : forecastTimeline,
    [forecastTimeline, isNightLightsMode, isSatelliteMode, observationTimeline],
  );
  const timelineTicks = useMemo(() => {
    if (!timelineItems.length) return [];
    const tickCount = isSatelliteMode ? 5 : 4;
    return Array.from({ length: tickCount }, (_, index) => {
      const itemIndex = Math.round((index * (timelineItems.length - 1)) / Math.max(1, tickCount - 1));
      return timelineItems[itemIndex];
    });
  }, [isSatelliteMode, timelineItems]);
  const activeTimelineIndex = isSatelliteMode
    ? observationTimeline.findIndex((frame) => frame.time === cloudState.activeObservationTime)
    : forecastTimeline.findIndex((item) => item.time === cloudState.activeForecastTime);
  const safeTimelineIndex = timelineItems.length
    ? Math.min(Math.max(activeTimelineIndex >= 0 ? activeTimelineIndex : 0, 0), timelineItems.length - 1)
    : 0;
  const activeTimelineTime = isSatelliteMode
    ? (timelineItems[safeTimelineIndex] as SatelliteFrame | undefined)?.time ?? null
    : timelineItems[safeTimelineIndex]?.time ?? null;
  const activeScheduleIndex = cloudState.activeForecastTime
    ? schedule.findIndex((item) => item.time === cloudState.activeForecastTime)
    : -1;
  const safeIndex = schedule.length
    ? Math.min(Math.max(activeScheduleIndex >= 0 ? activeScheduleIndex : 0, 0), schedule.length - 1)
    : 0;
  const current = isSatelliteMode
    ? { time: activeTimelineTime ?? "", nightKey: selectedNight }
    : activeScheduleIndex >= 0
    ? schedule[safeIndex]
    : cloudState.activeForecastTime
      ? { time: cloudState.activeForecastTime, nightKey: selectedNight }
      : schedule[safeIndex];
  const displayNight = current?.nightKey ?? selectedNight;
  const matrixTimes = useMemo(() => buildNightTimes(displayNight), [displayNight]);
  const matrixHours = useMemo(() => matrixTimes.map((time) => {
    const selectedHour = pointForecast?.hourly.find((hour) => hour.time === time);
    const gridHour = cloudGrid?.model === cloudState.model
      ? aggregateForecastHour(cloudGrid.forecasts.map((item) => item.hourly.find((hour) => hour.time === time)), time)
      : null;
    return selectedHour ?? gridHour ?? { time };
  }), [cloudGrid, cloudState.model, matrixTimes, pointForecast]);
  const activeForecastHour = forecastHours.find((hour) => hour.time === cloudState.activeForecastTime) ?? null;
  const selectedMatrixTime = matrixTimes.includes(cloudState.activeForecastTime ?? "")
    ? cloudState.activeForecastTime
    : null;
  // The expanded matrix is intentionally one night, while the compact rail is
  // a 72-hour forecast. Keep the summary/card bound to the actual active hour
  // even when the selected hour is outside the currently expanded night.
  const selectedHour = activeForecastHour ?? matrixHours.find((hour) => hour.time === selectedMatrixTime) ?? matrixHours[0];
  const activeSatelliteFrame = isSatelliteMode
    ? (observationTimeline[safeTimelineIndex] as SatelliteFrame | undefined) ?? null
    : null;
  const nightSummary = useMemo(
    () => pointForecast && selectedLocation ? evaluateNight(pointForecast, selectedLocation, displayNight) : null,
    [displayNight, pointForecast, selectedLocation],
  );

  useEffect(() => {
    if (!selectedLocation) {
      return;
    }
    const controller = new AbortController();
    const params = `lat=${selectedLocation.latitude}&lng=${selectedLocation.longitude}`;
    Promise.all([
      fetch(`/api/air-quality?${params}&days=2`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null),
      fetch(`/api/space-weather/kp`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null),
    ]).then(([air, space]) => {
      if (controller.signal.aborted) return;
      const airHour = air?.hourly?.find((item: { time?: string }) => item.time === (selectedMatrixTime ?? cloudState.activeForecastTime)) ?? air?.hourly?.[0];
      setAqiValue(typeof airHour?.usAqi === "number" ? airHour.usAqi : null);
      const kpFrames = (space?.frames ?? []).filter((item: { kp?: number }) => typeof item.kp === "number");
      const nearest = kpFrames.sort((a: { time: string }, b: { time: string }) => Math.abs(Date.parse(a.time) - Date.now()) - Math.abs(Date.parse(b.time) - Date.now()))[0];
      setKpValue(typeof nearest?.kp === "number" ? nearest.kp : null);
    }).catch(() => {
      if (!controller.signal.aborted) { setAqiValue(null); setKpValue(null); }
    });
    return () => controller.abort();
  }, [cloudState.activeForecastTime, selectedLocation, selectedMatrixTime]);

  useEffect(() => {
    if (isNightLightsMode) return;
    if (isSatelliteMode) {
      const frame = observationTimeline[safeTimelineIndex];
      if (frame && frame.time !== cloudState.activeObservationTime) {
        setCloud({ activeObservationTime: frame.time, playing: false });
      }
      return;
    }
    if (!forecastTimeline.length) return;
    const forecastIndex = forecastTimeline.findIndex((item) => item.time === cloudState.activeForecastTime);
    const selectedMatrixTimeIsInNight = matrixTimes.includes(cloudState.activeForecastTime ?? "");
    if (forecastIndex < 0 && !selectedMatrixTimeIsInNight) {
      setCloud({ activeForecastTime: forecastTimeline[0].time });
    }
  }, [cloudState.activeForecastTime, cloudState.activeObservationTime, forecastTimeline, isNightLightsMode, isSatelliteMode, matrixTimes, observationTimeline, safeTimelineIndex, setCloud]);

  useEffect(() => {
    if (isSatelliteMode || isNightLightsMode || !schedule.length) return;
    const nextTime = schedule[safeIndex]?.time ?? schedule[0].time;
    const activeIsNightTime = schedule.some((item) => item.time === cloudState.activeForecastTime);
    if (!cloudState.activeForecastTime || (activeIsNightTime && cloudState.timeIndex !== safeIndex)) {
      setCloud({ activeForecastTime: nextTime, timeIndex: safeIndex });
    }
  }, [cloudState.activeForecastTime, cloudState.timeIndex, isNightLightsMode, isSatelliteMode, safeIndex, schedule, setCloud]);

  useEffect(() => {
    if (!cloudState.playing || !timelineItems.length || isNightLightsMode) return;
    const interval = setInterval(() => {
      const nextIndex = (safeTimelineIndex + 1) % timelineItems.length;
      if (isSatelliteMode) {
        setCloud({ activeObservationTime: timelineItems[nextIndex].time });
      } else {
        setCloud({ activeForecastTime: timelineItems[nextIndex].time });
      }
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cloudState.playing, isNightLightsMode, isSatelliteMode, safeTimelineIndex, setCloud, timelineItems]);

  const setActiveTime = useCallback((time: string) => {
    if (isSatelliteMode) {
      setCloud({ activeObservationTime: time, playing: false });
      return;
    }
    const index = schedule.findIndex((item) => item.time === time);
    setCloud({ activeForecastTime: time, timeIndex: index >= 0 ? index : cloudState.timeIndex, playing: false });
  }, [cloudState.timeIndex, isSatelliteMode, schedule, setCloud]);

  const setTimelineIndex = useCallback((value: number) => {
    const item = timelineItems[Math.min(Math.max(value, 0), Math.max(0, timelineItems.length - 1))];
    if (item) setActiveTime(item.time);
  }, [setActiveTime, timelineItems]);

  const changeRange = (range: 1 | 5 | 7) => {
    const nextNights = nightRangeKeys(selectedNight, range);
    const nextSchedule = buildSchedule(nextNights);
    setCloud({ overlayMode: "forecast-cloud", range, activeForecastTime: nextSchedule[0]?.time ?? null, timeIndex: 0, playing: false });
  };

  const changeNight = (nightKey: string) => {
    selectNight(nightKey);
    const index = schedule.findIndex((item) => item.nightKey === nightKey);
    const time = schedule[index]?.time ?? buildNightTimes(nightKey)[0];
    setCloud({ activeForecastTime: time, timeIndex: Math.max(0, index), playing: false });
  };

  if (!cloudState.enabled) return null;

  return (
    <section className={`cloud-timeline${expanded ? " is-expanded" : " is-collapsed"}`} aria-label={isSatelliteMode ? "卫星云图时间工作台" : isNightLightsMode ? "光污染参考图层" : "逐小时预报时间工作台"} data-time-domain={isSatelliteMode ? "observation" : isNightLightsMode ? "reference" : "forecast"} data-active-time={activeTimelineTime ?? ""}>
      <div className="cloud-timeline-bar">
        <div className="cloud-timeline-title">
          <span className="section-kicker">{isSatelliteMode ? "卫星观测" : isNightLightsMode ? "光污染基准" : "逐小时预报"}</span>
          <strong>{isSatelliteMode ? "24 小时观测" : isNightLightsMode ? "VIIRS 2023 静态图层" : "当前至未来 72 小时"}</strong>
        </div>
        {!isNightLightsMode && <button type="button" className={`cloud-timeline-play${cloudState.playing ? " playing" : ""}`} onClick={() => setCloud({ playing: !cloudState.playing })} aria-label={cloudState.playing ? "暂停" : "播放"} disabled={!timelineItems.length}>
          {cloudState.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>}
          {!isNightLightsMode && <div className="cloud-timeline-slider">
            <input
              type="range"
              min={0}
              max={Math.max(0, timelineItems.length - 1)}
              value={safeTimelineIndex}
              disabled={!timelineItems.length || isNightLightsMode}
              aria-label={isSatelliteMode ? "过去 24 小时卫星观测时次" : "当前至未来 72 小时预报时次"}
              aria-valuetext={activeTimelineTime ?? "暂无时次"}
              onChange={(event) => setTimelineIndex(Number(event.target.value))}
            />
            <div className="cloud-timeline-labels" aria-hidden="true">
              {timelineTicks.map((item, index) => <span key={`${item.time}-${index}`}>{item?.time ? formatTimelineTime(item.time) : "暂无"}</span>)}
            </div>
          </div>}
          {!isSatelliteMode && !isNightLightsMode && <div className="cloud-timeline-range" role="group" aria-label="预报夜数">
           {RANGE_OPTIONS.map((option) => <button key={option.value} type="button" className={cloudState.range === option.value ? "active" : ""} aria-pressed={cloudState.range === option.value} onClick={() => changeRange(option.value)}>{option.label}</button>)}
          </div>}
          <span className="cloud-timeline-current" title={activeTimelineTime ?? undefined}>{isNightLightsMode ? "静态参考，无时间轴" : activeTimelineTime ? (isSatelliteMode ? formatTimelineTime(activeTimelineTime) : `${formatNightLabel(current.nightKey, true)} ${formatHourWithDate(activeTimelineTime, current.nightKey)}`) : "暂无时次"}</span>
        <button
          type="button"
          className="cloud-timeline-toggle"
          aria-expanded={expanded}
          aria-controls="hourly-forecast-panel"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
          <span>{expanded ? "收起数据" : "展开数据"}</span>
        </button>
      </div>

      <div className="cloud-timeline-data-card" aria-live="polite">
        {isNightLightsMode ? <>
          <b>光污染基准</b><span>VIIRS 2023</span><span>静态参考图层</span><small>来源：darkmap.cn · 不代表实时光污染、Bortle 或 SQM 实测</small>
        </> : activeSatelliteFrame ? <>
          <b>卫星观测</b><span>{activeSatelliteFrame.satellite}</span><span>{activeSatelliteFrame.label}</span><span>{formatTimelineTime(activeSatelliteFrame.time)}</span><small>来源：{activeSatelliteFrame.source} · {activeSatelliteFrame.coverage}</small>
        </> : <>
          <b>数值预报 · {cloudState.model.toUpperCase()}</b>
          <span>云量 {activeForecastHour?.cloudCover == null ? "—" : `${Math.round(activeForecastHour.cloudCover)}%`}</span>
          <span>降水 {activeForecastHour?.precipitation == null ? "—" : `${activeForecastHour.precipitation.toFixed(1)} mm`}</span>
          <span>风 {activeForecastHour?.windSpeed == null ? "—" : `${activeForecastHour.windSpeed.toFixed(1)} m/s`} {activeForecastHour?.windDirection == null ? "" : `${Math.round(activeForecastHour.windDirection)}°`}</span>
          <small>来源：{forecastSource} · Open-Meteo · {cloudState.model.toUpperCase()} · 时间：{activeForecastTimeLabel(activeForecastHour?.time)}</small>
        </>}
      </div>

      {expanded && (
        <div className="cloud-timeline-body" id="hourly-forecast-panel">
          {!isSatelliteMode && !isNightLightsMode && <div className="cloud-night-tabs" role="tablist" aria-label="观测夜选择">
            {nightKeys.map((nightKey) => <button key={nightKey} type="button" role="tab" aria-selected={displayNight === nightKey} className={displayNight === nightKey ? "active" : ""} onClick={() => changeNight(nightKey)}>{formatNightLabel(nightKey, true)}</button>)}
          </div>}

          {!isSatelliteMode && !isNightLightsMode && <div className="cloud-summary-card" aria-label="当前小时摘要">
            <span><b>观星分</b>{nightSummary?.score == null ? "—" : `${nightSummary.score}`}</span>
            <span><b>总云量</b>{selectedHour?.cloudCover == null ? "—" : `${Math.round(selectedHour.cloudCover)}%`}</span>
            <span><b>能见度</b>{selectedHour?.visibility == null ? "—" : `${(selectedHour.visibility / 1000).toFixed(1)} km`}</span>
            <span><b>风</b>{selectedHour?.windSpeed == null ? "—" : `${selectedHour.windSpeed.toFixed(1)} m/s`}</span>
            <span><b>AQI</b>{!selectedLocation || aqiValue == null ? "—" : aqiValue}</span>
            <span><b>Kp</b>{!selectedLocation || kpValue == null ? "—" : kpValue.toFixed(1)}</span>
            <span><b>月相</b>{nightSummary?.moonPhase ?? "—"}</span>
            <span><b>暗夜窗口</b>{nightSummary?.windowLabel ?? "—"}</span>
          </div>}

           {isSatelliteMode ? <div className="cloud-observation-note">当前为卫星观测时间轴；切换到“云量预报”后查看未来 72 小时逐小时矩阵。</div> : isNightLightsMode ? <div className="cloud-observation-note">当前为 VIIRS 2023 光污染静态参考图层；它没有逐小时时间域，不参与天气评分。</div> : <HourlyForecastMatrix nightKey={displayNight} hours={matrixHours} selectedTime={selectedMatrixTime} onSelectTime={setActiveTime} loading={state.cloudGridLoading} />}
          {state.cloudGridLoading && <div className="cloud-timeline-loading" role="status">正在采样云图数据…</div>}
        </div>
      )}
    </section>
  );
}

export { buildSchedule, HOURS_PER_NIGHT, NIGHT_START, NIGHT_END, isInNight, getValuesAtTime };
