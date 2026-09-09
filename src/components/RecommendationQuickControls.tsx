"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { forecastTimeWindow, formatNightLabel, isInNight } from "@/lib/nighttime";
import BortleFilterBar from "@/components/BortleFilterBar";

function describeScoreTime(time: string, start: string): string {
  if (!time) return "等待预报时间";
  const date = time.slice(0, 10);
  const startDate = start.slice(0, 10);
  const dayOffset = Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000,
  );
  const dayLabel = dayOffset === 0 ? "现在" : dayOffset === 1 ? "明天" : dayOffset === 2 ? "后天" : `第 ${dayOffset + 1} 天`;
  return `${dayLabel} · ${formatNightLabel(date, true)} ${time.slice(11, 16)}`;
}

/**首屏直接可调的暗空参考、评分时次和推荐门槛。*/
export default function RecommendationQuickControls() {
  const { state, setCloud, setRecommendationThreshold } = useStore();
  const [scoreWindowStart, setScoreWindowStart] = useState("");
  const initialScoreWindowRef = useRef(state.cloudState.activeForecastTime ?? "");

  useEffect(() => {
    queueMicrotask(() => setScoreWindowStart(initialScoreWindowRef.current));
  }, []);

  const scoreTimes = useMemo(
    () => (scoreWindowStart ? forecastTimeWindow(scoreWindowStart, 72) : []),
    [scoreWindowStart],
  );
  const activeScoreTime = scoreTimes.includes(state.cloudState.activeForecastTime ?? "")
    ? state.cloudState.activeForecastTime!
    : scoreTimes[0] ?? "";
  const activeScoreLabel = describeScoreTime(activeScoreTime, scoreWindowStart);

  useEffect(() => {
    if (!activeScoreTime) return;
    const activeForecastTime = state.cloudState.activeForecastTime;
    if (
      activeForecastTime &&
      (scoreTimes.includes(activeForecastTime) || isInNight(activeForecastTime, state.selectedNight))
    ) return;
    setCloud({ activeForecastTime: activeScoreTime, playing: false });
  }, [activeScoreTime, scoreTimes, setCloud, state.cloudState.activeForecastTime, state.selectedNight]);

  function setScoreTime(index: number) {
    const time = scoreTimes[Math.min(Math.max(index, 0), Math.max(0, scoreTimes.length - 1))];
    if (time) setCloud({ activeForecastTime: time, playing: false });
  }

  return (
    <div
      className="recommendation-quick-controls"
      data-testid="recommendation-quick-controls"
      role="group"
      aria-label="顶部地点筛选参数"
    >
      <div className="recommendation-quick-bortle">
        <span className="recommendation-quick-label">暗空参考</span>
        <BortleFilterBar variant="command" />
      </div>
      <label className="recommendation-quick-slider">
        <span>
          <span>评分时间</span>
          <strong>{activeScoreLabel}</strong>
        </span>
        <input
          type="range"
          min="0"
          max={Math.max(0, scoreTimes.length - 1)}
          value={Math.max(0, scoreTimes.indexOf(activeScoreTime))}
          onChange={(event) => setScoreTime(Number(event.target.value))}
          aria-label="观星评分时间滑窗"
          aria-valuetext={activeScoreLabel}
          disabled={!scoreTimes.length}
        />
      </label>
      <label className="recommendation-quick-slider">
        <span>
          <span>推荐门槛</span>
          <strong>≥{state.recommendationThreshold}分</strong>
        </span>
        <input
          type="range"
          min="50"
          max="90"
          step="5"
          value={state.recommendationThreshold}
          onChange={(event) => setRecommendationThreshold(Number(event.target.value))}
          aria-label="推荐分数门槛"
        />
      </label>
    </div>
  );
}
