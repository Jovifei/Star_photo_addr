"use client";

import { useMemo, useCallback } from "react";
import { Sparkles, Trash2, RotateCcw, Cloud, CloudRain, Wind, Clock } from "lucide-react";
import { cachedForecast, useStore } from "@/lib/store";
import { useCandidateForecasts } from "@/hooks/useCandidateForecasts";
import { projectCandidateNight, type NightMetricSummary } from "@/lib/candidateNightEvidence";
import { statusMeta } from "@/lib/scoring";
import { formatCalendarDate, formatNightLabel } from "@/lib/nighttime";
import { DEFAULT_CANDIDATE_SEEDS } from "@/lib/constants";
import type { CityCandidate, Location } from "@/lib/types";
import type { CityCandidateStatus } from "@/data/cities";

interface CandidateNightData {
  nightKey: string; score: number | null; statusTone: string; statusLabel: string;
  reason: string; windowLabel: string; windowLength: number;
  cloud: NightMetricSummary; precipitation: NightMetricSummary; wind: NightMetricSummary; loading: boolean;
  sourceFetchedAt: string | null; model: string | null; scoreTime: string | null; aggregation: string | null;
  blockedFields: Array<{ label: string; missingHours: number; totalHours: number }>;
}
function formatMetric(metric: NightMetricSummary, unit: string, digits = 0): string {
  if (metric.value === null) return "—";
  const value = digits ? metric.value.toFixed(digits) : String(Math.round(metric.value));
  const coverage = metric.totalHours > 0 && metric.validHours < metric.totalHours
    ? ` · ${metric.validHours}/${metric.totalHours}` : "";
  return `${value}${unit}${coverage}`;
}
function modelLabel(model: string | null): string {
  return model === "best_match" ? "最佳匹配" : model?.toUpperCase() ?? "未识别模型";
}
function getDayShortLabel(dateKey: string, index: number): string {
  if (index === 0) return "今";
  if (index === 1) return "明";
  if (index === 2) return "后";
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(`${dateKey}T12:00:00Z`).getUTCDay()] ?? "夜";
}
function getDateTabLabel(dateKey: string, index: number): { title: string; sub: string } {
  const title = index === 0 ? "今日" : index === 1 ? "明日" : index === 2 ? "后日" : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${dateKey}T12:00:00Z`).getUTCDay()] ?? "夜间";
  return { title, sub: formatCalendarDate(dateKey) };
}
export default function CandidateList({ candidates: propCandidates, activeId, onPick, onRemove }: {
  candidates?: CityCandidate[]; status?: CityCandidateStatus; activeId?: string;
  onPick: (candidate: CityCandidate) => void; onRemove?: (id: string) => void; onTrack?: (candidate: CityCandidate) => void;
}) {
  const { state, selectNight, selectCatalogNight, setCandidates } = useStore();
  const changeCatalogNight = selectCatalogNight ?? selectNight;
  const candidates = propCandidates ?? state.candidates;
  useCandidateForecasts(candidates);
  const catalogNightKeys = state.catalogNightKeys ?? state.nightKeys;
  const nightKeys = useMemo(() => catalogNightKeys.slice(0, 7), [catalogNightKeys]);
  const selectedNight = state.catalogSelectedNight ?? state.selectedNight ?? nightKeys[0] ?? "";
  const evaluatedCandidates = useMemo(() => candidates.map((candidate) => {
    const location: Location = { id: candidate.id, name: candidate.name, latitude: candidate.latitude,
      longitude: candidate.longitude, elevation: candidate.elevation ?? null, source: "自定义", province: candidate.province };
    const cached = cachedForecast(state.forecastCache, candidate.id, state.candidateForecastModel);
    const sameSelectedPoint = state.selectedLocation && Math.abs(state.selectedLocation.latitude - candidate.latitude) < 1e-6 && Math.abs(state.selectedLocation.longitude - candidate.longitude) < 1e-6;
    const available = cached?.metadata?.model === state.candidateForecastModel ? cached : sameSelectedPoint ? state.forecast : null;
    const forecast = available?.metadata?.model === state.candidateForecastModel ? available : null;
    const nights = new Map<string, CandidateNightData>();
    nightKeys.forEach((nightKey, index) => {
      const evidence = projectCandidateNight(forecast, location, nightKey, index, state.candidateForecastModel);
      const result = evidence.evaluation;
      nights.set(nightKey, {
        nightKey, score: result?.score ?? null, statusTone: result ? statusMeta(result.status).tone : "muted",
        statusLabel: evidence.statusLabel, reason: evidence.reason,
        windowLabel: result?.windowLabel ?? evidence.reason, windowLength: result?.window.length ?? 0,
        cloud: evidence.metrics.cloudCover, precipitation: evidence.metrics.precipitationProbability,
        wind: evidence.metrics.windSpeed, loading: false,
        sourceFetchedAt: evidence.sourceFetchedAt, model: evidence.model,
        scoreTime: result?.scoreTime ?? null, aggregation: result?.aggregation ?? null,
        blockedFields: evidence.blockedFields,
      });
    });
    const currentNight = nights.get(selectedNight) ?? { nightKey: selectedNight, score: null, statusTone: "muted", statusLabel: "数据不足", reason: "暂无天气数据", windowLabel: "暂无数据", windowLength: 0,
      cloud: { value: null, validHours: 0, totalHours: 0 }, precipitation: { value: null, validHours: 0, totalHours: 0 }, wind: { value: null, validHours: 0, totalHours: 0 },
      loading: false, sourceFetchedAt: null, model: null, scoreTime: null, aggregation: null, blockedFields: [] };
    return { candidate, nights, currentNight };
  }), [candidates, nightKeys, selectedNight, state.forecastCache, state.selectedLocation, state.forecast, state.candidateForecastModel]);
  const sortedCandidates = useMemo(() => [...evaluatedCandidates].sort((a, b) => {
    const left = a.currentNight.score, right = b.currentNight.score;
    if (left === null && right === null) return a.candidate.name.localeCompare(b.candidate.name, "zh-CN");
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  }), [evaluatedCandidates]);
  const handleResetSeeds = useCallback(() => setCandidates(DEFAULT_CANDIDATE_SEEDS), [setCandidates]);
  const hasCandidates = sortedCandidates.length > 0;
  return (
    <div className="candidate-leaderboard panel-section">
      <div className="candidate-leaderboard-header">
        <div className="candidate-leaderboard-title-group">
          <div className="candidate-leaderboard-kicker"><Sparkles size={13} className="sparkle-icon" /><span>候选对比 · 7天窗口预报</span></div>
          <h3 className="candidate-leaderboard-title">整晚窗口预报对比</h3>
        </div>
        <span className="candidate-count-badge">{hasCandidates ? `${sortedCandidates.length} 个候选地点` : "无数据"}</span>
      </div>
      <p className="candidate-footer-hint" role="note">{modelLabel(state.candidateForecastModel)} 单模型 · 整晚最佳连续 3 小时分，不是当前时次分或现场保证。缺失/过期数据不排名。</p>
      <div className="candidate-date-tabs" role="tablist" aria-label="7天日期切换">
        {nightKeys.map((key, index) => {
          const { title, sub } = getDateTabLabel(key, index);
          return <button key={key} type="button" role="tab" aria-selected={key === selectedNight} className={`candidate-date-tab ${key === selectedNight ? "candidate-date-tab--active" : ""}`} onClick={() => changeCatalogNight(key)} title={`${formatNightLabel(key, true)}；点击按该夜评分重排候选地点`}><span className="candidate-date-tab-title">{title}</span><span className="candidate-date-tab-sub">{sub}</span></button>;
        })}
      </div>
      <div className="candidate-cards-container">
        {!hasCandidates ? <div className="candidate-empty-state">
          <p className="candidate-empty-text">暂无候选对比点位。在地图上点击任意位置，或在右侧详情点击「加入候选对比」，即可纳入 7 天排行榜。</p>
          <button type="button" className="candidate-reset-seeds-btn" onClick={handleResetSeeds}><RotateCcw size={14} /><span>载入 {DEFAULT_CANDIDATE_SEEDS.length} 个精选摄影地点</span></button>
        </div> : sortedCandidates.map(({ candidate, currentNight, nights }, index) => {
          const rank = index + 1;
          const rankClass = currentNight.score === null ? "rank-badge--default" : rank === 1 ? "rank-badge--gold" : rank === 2 ? "rank-badge--silver" : rank === 3 ? "rank-badge--bronze" : "rank-badge--default";
          return <div key={candidate.id} className={`candidate-card ${activeId === candidate.id ? "candidate-card--active" : ""}`} onClick={() => onPick(candidate)} role="group" aria-label={`${candidate.name} 候选预报`}>
            <div className="candidate-card-top">
              <button type="button" className="candidate-card-identity" aria-label={`选择候选地点 ${candidate.name}`} aria-pressed={activeId === candidate.id} onClick={(event) => { event.stopPropagation(); onPick(candidate); }}>
                <span className={`candidate-rank-badge ${rankClass}`}>{currentNight.score === null ? "—" : `#${rank}`}</span>
                <span className="candidate-name-box"><span className="candidate-name">{candidate.name}</span><span className="candidate-meta">{candidate.province || "未知"}{candidate.elevation != null ? ` · ${candidate.elevation}m` : ""}</span></span>
              </button>
              <div className="candidate-card-score-box" title={currentNight.windowLabel}>
                <div className="candidate-score-number"><strong>{currentNight.score ?? "—"}</strong>{currentNight.score !== null && <small>分</small>}</div>
                <span className={`candidate-status-pill tone-${currentNight.statusTone}`} title={currentNight.reason}>{currentNight.statusLabel}</span>
                {onRemove && <button type="button" className="candidate-card-delete" onClick={(event) => { event.stopPropagation(); onRemove(candidate.id); }} aria-label={`从候选对比中移除 ${candidate.name}`} title="移出候选对比"><Trash2 size={13} /></button>}
              </div>
            </div>
            <div className="candidate-metrics-row">
              <div className="candidate-metric-item" title={`夜间平均总云量；${currentNight.cloud.validHours}/${currentNight.cloud.totalHours} 时次有效`}><Cloud size={12} className="metric-icon" /><span>云量 {formatMetric(currentNight.cloud, "%")}</span></div>
              <div className="candidate-metric-item" title={`夜间最高降水概率；${currentNight.precipitation.validHours}/${currentNight.precipitation.totalHours} 时次有效，缺失不填零`}><CloudRain size={12} className="metric-icon" /><span>降水 {formatMetric(currentNight.precipitation, "%")}</span></div>
              <div className="candidate-metric-item" title={`夜间最大风速；${currentNight.wind.validHours}/${currentNight.wind.totalHours} 时次有效`}><Wind size={12} className="metric-icon" /><span>风速 {formatMetric(currentNight.wind, "m/s", 1)}</span></div>
              <div className="candidate-metric-item" title={currentNight.windowLabel}><Clock size={12} className="metric-icon" /><span>窗口 {currentNight.windowLength > 0 ? `${currentNight.windowLength} 个小时采样` : "无"}</span></div>
            </div>
            <p className="candidate-provenance" data-testid="candidate-provenance">数据身份：{modelLabel(currentNight.model)} · 原始抓取：{currentNight.sourceFetchedAt ?? "未提供"} · 评分：{currentNight.aggregation ?? "暂缓"}{currentNight.scoreTime ? `（${currentNight.scoreTime}）` : ""}（{currentNight.score ?? "—"}） · {currentNight.reason}</p>
            <div className="candidate-7day-capsules">{nightKeys.map((key, dayIdx) => {
              const data = nights.get(key), score = data?.score ?? null;
              const tone = score === null ? "" : score >= 80 ? "capsule--great" : score >= 65 ? "capsule--good" : score >= 50 ? "capsule--fair" : "capsule--poor";
              return <button key={key} type="button" className={`mini-capsule ${tone} ${key === selectedNight ? "mini-capsule--active" : ""}`} onClick={(event) => { event.stopPropagation(); changeCatalogNight(key); }} title={score === null ? `${formatNightLabel(key, true)}: ${data?.windowLabel ?? "数据不足"}` : `${formatNightLabel(key, true)}: 整晚窗口 ${score}分 (${data?.statusLabel ?? ""})；点击切换`}><span className="mini-capsule-day">{getDayShortLabel(key, dayIdx)}</span><span className="mini-capsule-score">{score ?? "—"}</span></button>;
            })}</div>
          </div>;
        })}
      </div>
      {hasCandidates && <div className="candidate-footer-hint"><span>点击地图任意地点或搜索，在右侧详情中「加入候选对比」参与排名</span></div>}
    </div>
  );
}
