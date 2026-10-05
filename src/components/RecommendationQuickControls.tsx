"use client";

import { useEffect, useId, useMemo } from "react";
import { useStore } from "@/lib/store";
import { forecastTimeWindow, formatHourWithDate, formatNightLabel, isInNight } from "@/lib/nighttime";
import BortleFilterBar from "@/components/BortleFilterBar";

function describeScoreTime(time: string, start: string): string {
  if (!time) return "等待预报时间";
  const date = time.slice(0, 10);
  const startDate = start.slice(0, 10);
  const dayOffset = Math.round(
    (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${startDate}T12:00:00Z`)) / 86_400_000,
  );
  const dayLabel = dayOffset === 0 ? "今日" : dayOffset === 1 ? "明日" : dayOffset === 2 ? "后日" : `第 ${dayOffset + 1} 天`;
  return `${dayLabel} · ${formatNightLabel(date, true)} ${time.slice(11, 16)}`;
}

/**首屏直接可调的暗空参考、评分时次和推荐门槛。*/
export default function RecommendationQuickControls() {
  const {
    state,
    setCloud,
    setRecommendationThreshold,
    setRecommendedOnly,
  } = useStore();
  const scoreWindowStart = state.forecastWindowStart;
  const windowNoteId = useId();

  const scoreTimes = useMemo(
    () => (scoreWindowStart ? forecastTimeWindow(scoreWindowStart, 72) : []),
    [scoreWindowStart],
  );
  const activeScoreTime = scoreTimes.includes(state.cloudState.activeForecastTime ?? "")
    ? state.cloudState.activeForecastTime!
    : scoreTimes[0] ?? "";
  const activeScoreLabel = describeScoreTime(activeScoreTime, scoreWindowStart);
  const selectedTime = state.cloudState.activeForecastTime;
  const selectedNightOutsideWindow = Boolean(selectedTime && !scoreTimes.includes(selectedTime) && isInNight(selectedTime, state.selectedNight));
  const selectedScoreLabel = selectedNightOutsideWindow
    ? `观测夜 · ${formatNightLabel(state.selectedNight, true)} ${formatHourWithDate(selectedTime!, state.selectedNight)}`
    : activeScoreLabel;

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
      <label className="recommendation-quick-slider">
        <span>
          <span>评分时间</span>
          <strong>{selectedScoreLabel}</strong>
        </span>
        <input
          type="range"
          min="0"
          max={Math.max(0, scoreTimes.length - 1)}
          value={Math.max(0, scoreTimes.indexOf(activeScoreTime))}
          onChange={(event) => setScoreTime(Number(event.target.value))}
          aria-label="观星评分时间滑窗"
          aria-valuetext={activeScoreLabel}
          aria-describedby={selectedNightOutsideWindow ? windowNoteId : undefined}
          disabled={!scoreTimes.length}
        />
        {selectedNightOutsideWindow && <small id={windowNoteId}>当前选择来自观测夜，拖动滑窗切回未来72小时</small>}
      </label>
      <div className="recommendation-quick-bortle">
        <span className="recommendation-quick-label">暗空参考</span>
        <BortleFilterBar variant="command" />
      </div>
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
      <label
        className="recommendation-quick-toggle"
        data-testid="recommended-only-toggle"
        title={`仅显示评分 ≥${state.recommendationThreshold} 的地点`}
      >
        <input
          type="checkbox"
          aria-label="仅显示达到推荐门槛的地点"
          checked={state.recommendedOnly}
          onChange={(event) => setRecommendedOnly(event.target.checked)}
        />
        <span>仅显示达到推荐门槛的地点</span>
      </label>
    </div>
  );
}
