"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Pause, Play } from "lucide-react";
import { useStore } from "@/lib/store";
import { NIGHT_END, NIGHT_START } from "@/lib/constants";
import { formatHourWithDate, formatNightLabel, nightRangeKeys } from "@/lib/nighttime";
import { HOURS_PER_NIGHT } from "@/lib/nighttime";
import { isInNight } from "@/lib/nighttime";
import { getValuesAtTime } from "@/lib/cloudGrid";
import type { HourWeather } from "@/lib/types";
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

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
}

function cloudGridHour(grid: NonNullable<ReturnType<typeof useStore>["state"]["cloudGrid"]>, time: string): HourWeather | null {
  const hours = grid.forecasts.map((forecast) => forecast.hourly.find((hour) => hour.time === time)).filter(Boolean);
  if (!hours.length) return null;
  return {
    time,
    cloudCover: average(hours.map((hour) => hour?.cloudCover)),
    cloudHigh: average(hours.map((hour) => hour?.cloudHigh)),
    cloudMid: average(hours.map((hour) => hour?.cloudMid)),
    cloudLow: average(hours.map((hour) => hour?.cloudLow)),
  };
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
  const activeIndex = Math.max(
    0,
    cloudState.activeForecastTime
      ? schedule.findIndex((item) => item.time === cloudState.activeForecastTime)
      : cloudState.timeIndex,
  );
  const safeIndex = schedule.length ? Math.min(activeIndex, schedule.length - 1) : 0;
  const current = schedule[safeIndex];
  const displayNight = current?.nightKey ?? selectedNight;
  const matrixTimes = useMemo(() => buildNightTimes(displayNight), [displayNight]);
  const matrixHours = useMemo(() => matrixTimes.map((time) => {
    const selectedHour = forecast?.hourly.find((hour) => hour.time === time);
    return selectedHour ?? (cloudGrid ? cloudGridHour(cloudGrid, time) : null) ?? { time };
  }), [cloudGrid, forecast, matrixTimes]);
  const selectedMatrixTime = current?.nightKey === displayNight ? current.time : matrixTimes[0];
  const selectedHour = matrixHours.find((hour) => hour.time === selectedMatrixTime) ?? matrixHours[0];
  const nightSummary = useMemo(
    () => forecast && selectedLocation ? evaluateNight(forecast, selectedLocation, displayNight) : null,
    [displayNight, forecast, selectedLocation],
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
      const airHour = air?.hourly?.find((item: { time?: string }) => item.time === selectedMatrixTime) ?? air?.hourly?.[0];
      setAqiValue(typeof airHour?.usAqi === "number" ? airHour.usAqi : null);
      const kpFrames = (space?.frames ?? []).filter((item: { kp?: number }) => typeof item.kp === "number");
      const nearest = kpFrames.sort((a: { time: string }, b: { time: string }) => Math.abs(Date.parse(a.time) - Date.now()) - Math.abs(Date.parse(b.time) - Date.now()))[0];
      setKpValue(typeof nearest?.kp === "number" ? nearest.kp : null);
    }).catch(() => {
      if (!controller.signal.aborted) { setAqiValue(null); setKpValue(null); }
    });
    return () => controller.abort();
  }, [selectedLocation, selectedMatrixTime]);

  useEffect(() => {
    if (!schedule.length) return;
    const nextTime = schedule[safeIndex]?.time ?? schedule[0].time;
    if (cloudState.activeForecastTime !== nextTime || cloudState.timeIndex !== safeIndex) {
      setCloud({ activeForecastTime: nextTime, timeIndex: safeIndex });
    }
  }, [cloudState.activeForecastTime, cloudState.timeIndex, safeIndex, schedule, setCloud]);

  useEffect(() => {
    if (!cloudState.playing || !schedule.length) return;
    const interval = setInterval(() => {
      const nextIndex = (safeIndex + 1) % schedule.length;
      setCloud({
        activeForecastTime: schedule[nextIndex].time,
        timeIndex: nextIndex,
      });
    }, PLAY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cloudState.playing, safeIndex, schedule, setCloud]);

  const setActiveTime = useCallback((time: string) => {
    const index = schedule.findIndex((item) => item.time === time);
    if (index >= 0) setCloud({ activeForecastTime: time, timeIndex: index });
  }, [schedule, setCloud]);

  const changeRange = (range: 1 | 5 | 7) => {
    const nextNights = nightRangeKeys(selectedNight, range);
    const nextSchedule = buildSchedule(nextNights);
    setCloud({ range, activeForecastTime: nextSchedule[0]?.time ?? null, timeIndex: 0, playing: false });
  };

  const changeNight = (nightKey: string) => {
    selectNight(nightKey);
    const index = schedule.findIndex((item) => item.nightKey === nightKey);
    const time = schedule[index]?.time ?? buildNightTimes(nightKey)[0];
    setCloud({ activeForecastTime: time, timeIndex: Math.max(0, index), playing: false });
  };

  if (!cloudState.enabled) return null;

  return (
    <section className={`cloud-timeline${expanded ? " is-expanded" : " is-collapsed"}`} aria-label="逐小时预报面板">
      <div className="cloud-timeline-bar">
        <div className="cloud-timeline-title">
          <span className="section-kicker">逐小时预报</span>
          <strong>单夜数据</strong>
        </div>
        <button type="button" className="cloud-timeline-play" onClick={() => setCloud({ playing: !cloudState.playing })} aria-label={cloudState.playing ? "暂停" : "播放"}>
          {cloudState.playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        </button>
        <div className="cloud-timeline-range" role="group" aria-label="预报夜数">
          {RANGE_OPTIONS.map((option) => <button key={option.value} type="button" className={cloudState.range === option.value ? "active" : ""} aria-pressed={cloudState.range === option.value} onClick={() => changeRange(option.value)}>{option.label}</button>)}
        </div>
        <span className="cloud-timeline-current" title={current ? formatHourWithDate(current.time, current.nightKey) : undefined}>{current ? `${formatNightLabel(current.nightKey, true)} ${formatHourWithDate(current.time, current.nightKey)}` : "暂无时次"}</span>
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

      {expanded && (
        <div className="cloud-timeline-body" id="hourly-forecast-panel">
          <div className="cloud-night-tabs" role="tablist" aria-label="观测夜选择">
            {nightKeys.map((nightKey) => <button key={nightKey} type="button" role="tab" aria-selected={displayNight === nightKey} className={displayNight === nightKey ? "active" : ""} onClick={() => changeNight(nightKey)}>{formatNightLabel(nightKey, true)}</button>)}
          </div>

          <div className="cloud-summary-card" aria-label="当前小时摘要">
            <span><b>观星分</b>{nightSummary?.score == null ? "—" : `${nightSummary.score}`}</span>
            <span><b>总云量</b>{selectedHour?.cloudCover == null ? "—" : `${Math.round(selectedHour.cloudCover)}%`}</span>
            <span><b>能见度</b>{selectedHour?.visibility == null ? "—" : `${(selectedHour.visibility / 1000).toFixed(1)} km`}</span>
            <span><b>风</b>{selectedHour?.windSpeed == null ? "—" : `${selectedHour.windSpeed.toFixed(1)} m/s`}</span>
            <span><b>AQI</b>{!selectedLocation || aqiValue == null ? "—" : aqiValue}</span>
            <span><b>Kp</b>{!selectedLocation || kpValue == null ? "—" : kpValue.toFixed(1)}</span>
            <span><b>月相</b>{nightSummary?.moonPhase ?? "—"}</span>
            <span><b>暗夜窗口</b>{nightSummary?.windowLabel ?? "—"}</span>
          </div>

          <HourlyForecastMatrix nightKey={displayNight} hours={matrixHours} selectedTime={selectedMatrixTime} onSelectTime={setActiveTime} loading={state.cloudGridLoading} />
          {state.cloudGridLoading && <div className="cloud-timeline-loading" role="status">正在采样云图数据…</div>}
        </div>
      )}
    </section>
  );
}

export { buildSchedule, HOURS_PER_NIGHT, NIGHT_START, NIGHT_END, isInNight, getValuesAtTime };
