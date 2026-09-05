"use client";

import { useEffect, useMemo, useCallback } from "react";
import { Sparkles, Trash2, RotateCcw, Cloud, CloudRain, Wind, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { evaluateNight, statusMeta } from "@/lib/scoring";
import { formatNightLabel } from "@/lib/nighttime";
import { DEFAULT_CANDIDATE_SEEDS } from "@/lib/constants";
import { FINDER_LOCATIONS } from "@/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/finderData";
import type { CityCandidate, Location, LocationForecast, NightEvaluation } from "@/lib/types";
import type { CityCandidateStatus } from "@/data/cities";

interface CandidateNightData {
  nightKey: string;
  score: number;
  statusTone: string;
  statusLabel: string;
  windowLabel: string;
  windowLength: number;
  cloud: number | null;
  precipitation: number | null;
  wind: number | null;
  loading: boolean;
}

interface EvaluatedCandidate {
  candidate: CityCandidate;
  nights: Map<string, CandidateNightData>;
  currentNight: CandidateNightData;
}

/**
 * Fetch and cache forecast for a candidate if not already in store.
 */
async function fetchAndCacheCandidateForecast(
  candidate: CityCandidate,
  cacheForecast: (id: string, forecast: LocationForecast) => void,
): Promise<void> {
  const url = `/api/forecast?latitude=${candidate.latitude}&longitude=${candidate.longitude}&days=14&model=icon`;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const forecast: LocationForecast | null = data.locations?.[0] ?? null;
    if (forecast) {
      cacheForecast(candidate.id, forecast);
    }
  } catch {
    // Ignore fetch error
  }
}

/**
 * Short weekday label for the 7-day capsule bar.
 */
function getDayShortLabel(dateKey: string, index: number): string {
  if (index === 0) return "今";
  if (index === 1) return "明";
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  const weekMap = ["日", "一", "二", "三", "四", "五", "六"];
  return weekMap[day] ?? "夜";
}

/**
 * Tab label for top date selector.
 */
function getDateTabLabel(dateKey: string, index: number): { title: string; sub: string } {
  const [, m, d] = dateKey.split("-");
  const sub = `${Number(m)}/${Number(d)}`;
  if (index === 0) return { title: "今夜", sub };
  if (index === 1) return { title: "明夜", sub };
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  const weekMap = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return { title: weekMap[day] ?? "夜间", sub };
}

export default function CandidateList({
  candidates: propCandidates,
  activeId,
  onPick,
  onRemove,
}: {
  candidates?: CityCandidate[];
  status?: CityCandidateStatus;
  activeId?: string;
  onPick: (candidate: CityCandidate) => void;
  onRemove?: (id: string) => void;
  onTrack?: (candidate: CityCandidate) => void;
}) {
  const { state, selectNight, cacheForecast, setCandidates } = useStore();
  const candidates = propCandidates ?? state.candidates;
  const nightKeys = state.nightKeys.slice(0, 7);
  const selectedNight = state.selectedNight || nightKeys[0] || "";

  // Trigger background fetch for any candidates not yet cached
  useEffect(() => {
    candidates.forEach((cand) => {
      if (!state.forecastCache.has(cand.id)) {
        void fetchAndCacheCandidateForecast(cand, cacheForecast);
      }
    });
  }, [candidates, state.forecastCache, cacheForecast]);

  // Compute 7-day evaluations for all candidates
  const evaluatedCandidates: EvaluatedCandidate[] = useMemo(() => {
    return candidates.map((cand) => {
      const loc: Location = {
        id: cand.id,
        name: cand.name,
        latitude: cand.latitude,
        longitude: cand.longitude,
        elevation: cand.elevation ?? null,
        source: "自定义",
        province: cand.province,
        bortle: cand.bortle,
      };

      const forecast =
        state.forecastCache.get(cand.id) ??
        (state.selectedLocation?.id === cand.id ? state.forecast : null);

      const nights = new Map<string, CandidateNightData>();

      nightKeys.forEach((key, index) => {
        let evalResult: NightEvaluation | null = null;
        if (forecast) {
          evalResult = evaluateNight(forecast, loc, key, index);
        }

        if (evalResult) {
          const meta = statusMeta(evalResult.status);
          const hrs = evalResult.hours ?? [];
          const avgCloud = hrs.length
            ? Math.round(hrs.reduce((acc, h) => acc + (h.cloudCover ?? 0), 0) / hrs.length)
            : null;
          const maxPrecip = hrs.length
            ? Math.round(Math.max(...hrs.map((h) => h.precipitationProbability ?? 0)))
            : null;
          const maxWind = hrs.length
            ? Math.round(Math.max(...hrs.map((h) => h.windSpeed ?? 0)))
            : null;

          nights.set(key, {
            nightKey: key,
            score: evalResult.score,
            statusTone: meta.tone,
            statusLabel: evalResult.score >= 85 ? "强烈推荐" : meta.label,
            windowLabel: evalResult.windowLabel,
            windowLength: evalResult.window.length,
            cloud: avgCloud,
            precipitation: maxPrecip,
            wind: maxWind,
            loading: false,
          });
        } else {
          // Pre-computed snapshot fallback from finderData
          const finder = FINDER_LOCATIONS.find(
            (f) =>
              f.id === cand.id ||
              (Math.abs(f.latitude - cand.latitude) < 0.08 &&
                Math.abs(f.longitude - cand.longitude) < 0.08) ||
              (cand.name && (f.name.includes(cand.name) || cand.name.includes(f.name))),
          );

          // Baseline estimation based on Bortle
          const baseScore = Math.max(40, 95 - (cand.bortle || 3) * 8);
          nights.set(key, {
            nightKey: key,
            score: finder ? Math.max(50, baseScore) : baseScore,
            statusTone: "muted",
            statusLabel: "加载中",
            windowLabel: "计算中…",
            windowLength: 0,
            cloud: null,
            precipitation: null,
            wind: null,
            loading: true,
          });
        }
      });

      const currentNight =
        nights.get(selectedNight) ??
        nights.values().next().value ?? {
          nightKey: selectedNight,
          score: 50,
          statusTone: "muted",
          statusLabel: "无数据",
          windowLabel: "暂无数据",
          windowLength: 0,
          cloud: null,
          precipitation: null,
          wind: null,
          loading: false,
        };

      return {
        candidate: cand,
        nights,
        currentNight,
      };
    });
  }, [
    candidates,
    nightKeys,
    selectedNight,
    state.forecastCache,
    state.selectedLocation,
    state.forecast,
  ]);

  // Sort descending by current night's score
  const sortedCandidates = useMemo(() => {
    return [...evaluatedCandidates].sort((a, b) => b.currentNight.score - a.currentNight.score);
  }, [evaluatedCandidates]);

  const handleResetSeeds = useCallback(() => {
    setCandidates(DEFAULT_CANDIDATE_SEEDS);
  }, [setCandidates]);

  const hasCandidates = sortedCandidates.length > 0;

  return (
    <div className="candidate-leaderboard panel-section">
      {/* Header */}
      <div className="candidate-leaderboard-header">
        <div className="candidate-leaderboard-title-group">
          <div className="candidate-leaderboard-kicker">
            <Sparkles size={13} className="sparkle-icon" />
            <span>候选对比 · 7天分数排行</span>
          </div>
          <h3 className="candidate-leaderboard-title">星空胜地实时优选</h3>
        </div>
        <span className="candidate-count-badge">
          {hasCandidates ? `${sortedCandidates.length} 个候选地点` : "无数据"}
        </span>
      </div>

      {/* Top 7-Day Date Tabs */}
      <div className="candidate-date-tabs" role="tablist" aria-label="7天日期切换">
        {nightKeys.map((key, index) => {
          const isSelected = key === selectedNight;
          const { title, sub } = getDateTabLabel(key, index);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`candidate-date-tab ${isSelected ? "candidate-date-tab--active" : ""}`}
              onClick={() => selectNight(key)}
              title={`${formatNightLabel(key, true)}；点击按该夜评分重排候选地点`}
            >
              <span className="candidate-date-tab-title">{title}</span>
              <span className="candidate-date-tab-sub">{sub}</span>
            </button>
          );
        })}
      </div>

      {/* Candidate Cards List */}
      <div className="candidate-cards-container">
        {!hasCandidates ? (
          <div className="candidate-empty-state">
            <p className="candidate-empty-text">
              暂无候选对比点位。在地图上点击任意位置，或在右侧详情点击「加入候选对比」，即可纳入 7 天排行榜。
            </p>
            <button
              type="button"
              className="candidate-reset-seeds-btn"
              onClick={handleResetSeeds}
            >
              <RotateCcw size={14} />
              <span>载入 4 大经典观星名山</span>
            </button>
          </div>
        ) : (
          sortedCandidates.map(({ candidate, currentNight, nights }, index) => {
            const rank = index + 1;
            const isActive = activeId === candidate.id;
            const rankClass =
              rank === 1
                ? "rank-badge--gold"
                : rank === 2
                  ? "rank-badge--silver"
                  : rank === 3
                    ? "rank-badge--bronze"
                    : "rank-badge--default";

            return (
              <div
                key={candidate.id}
                className={`candidate-card ${isActive ? "candidate-card--active" : ""}`}
                onClick={() => onPick(candidate)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onPick(candidate);
                  }
                }}
              >
                {/* Top Row: Rank, Title, Province, Score & Grade */}
                <div className="candidate-card-top">
                  <div className="candidate-card-identity">
                    <span className={`candidate-rank-badge ${rankClass}`}>
                      #{rank}
                    </span>
                    <div className="candidate-name-box">
                      <span className="candidate-name">{candidate.name}</span>
                      <span className="candidate-meta">
                        {candidate.province || "未知"}
                        {candidate.elevation ? ` · ${candidate.elevation}m` : ""}
                        {candidate.bortle > 0 ? ` · B${candidate.bortle}` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="candidate-card-score-box">
                    <div className="candidate-score-number">
                      <strong>{currentNight.score}</strong>
                      <small>分</small>
                    </div>
                    <span className={`candidate-status-pill tone-${currentNight.statusTone}`}>
                      {currentNight.statusLabel}
                    </span>
                    {onRemove && (
                      <button
                        type="button"
                        className="candidate-card-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(candidate.id);
                        }}
                        aria-label={`从候选对比中移除 ${candidate.name}`}
                        title="移出候选对比"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Weather Metrics Strip */}
                <div className="candidate-metrics-row">
                  <div className="candidate-metric-item" title="夜间平均云量">
                    <Cloud size={12} className="metric-icon" />
                    <span>云量 {currentNight.cloud != null ? `${currentNight.cloud}%` : "—"}</span>
                  </div>
                  <div className="candidate-metric-item" title="最高降水概率">
                    <CloudRain size={12} className="metric-icon" />
                    <span>降水 {currentNight.precipitation != null ? `${currentNight.precipitation}%` : "0%"}</span>
                  </div>
                  <div className="candidate-metric-item" title="最大阵风速度">
                    <Wind size={12} className="metric-icon" />
                    <span>风速 {currentNight.wind != null ? `${currentNight.wind}m/s` : "—"}</span>
                  </div>
                  <div className="candidate-metric-item" title="连续可用观星窗口">
                    <Clock size={12} className="metric-icon" />
                    <span>窗口 {currentNight.windowLength > 0 ? `${currentNight.windowLength}h` : "无"}</span>
                  </div>
                </div>

                {/* 7-Day Mini Capsule Bar */}
                <div className="candidate-7day-capsules">
                  {nightKeys.map((key, dayIdx) => {
                    const nightData = nights.get(key);
                    const score = nightData?.score ?? 50;
                    const isKeySelected = key === selectedNight;
                    const dayLabel = getDayShortLabel(key, dayIdx);

                    const scoreTone =
                      score >= 80 ? "capsule--great" : score >= 65 ? "capsule--good" : score >= 50 ? "capsule--fair" : "capsule--poor";

                    return (
                      <button
                        key={key}
                        type="button"
                        className={`mini-capsule ${scoreTone} ${isKeySelected ? "mini-capsule--active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectNight(key);
                        }}
                        title={`${formatNightLabel(key, true)}: ${score}分 (${nightData?.statusLabel ?? ""})；点击切换`}
                      >
                        <span className="mini-capsule-day">{dayLabel}</span>
                        <span className="mini-capsule-score">{score}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      {hasCandidates && (
        <div className="candidate-footer-hint">
          <span>点击地图任意地点或搜索，在右侧详情中「加入候选对比」参与排名</span>
        </div>
      )}
    </div>
  );
}
