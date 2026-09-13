"use client";

import { useMemo, useCallback } from "react";
import { Sparkles, Trash2, RotateCcw, Cloud, CloudRain, Wind, Clock } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCandidateForecasts } from "@/hooks/useCandidateForecasts";
import { evaluateNight, statusMeta } from "@/lib/scoring";
import { forecastTrustIssue } from "@/lib/forecastIntegrity";
import { formatNightLabel } from "@/lib/nighttime";
import { DEFAULT_CANDIDATE_SEEDS } from "@/lib/constants";
import type { CityCandidate, Location } from "@/lib/types";
import type { CityCandidateStatus } from "@/data/cities";

interface CandidateNightData {
  nightKey: string; score: number | null; statusTone: string; statusLabel: string;
  windowLabel: string; windowLength: number; cloud: number | null;
  precipitation: number | null; wind: number | null; loading: boolean;
}
function getDayShortLabel(dateKey: string, index: number): string {
  if (index === 0) return "今";
  if (index === 1) return "明";
  return ["日", "一", "二", "三", "四", "五", "六"][new Date(`${dateKey}T12:00:00Z`).getUTCDay()] ?? "夜";
}
function getDateTabLabel(dateKey: string, index: number): { title: string; sub: string } {
  const [, m, d] = dateKey.split("-");
  const title = index === 0 ? "今夜" : index === 1 ? "明夜" : ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date(`${dateKey}T12:00:00Z`).getUTCDay()] ?? "夜间";
  return { title, sub: `${Number(m)}/${Number(d)}` };
}
export default function CandidateList({ candidates: propCandidates, activeId, onPick, onRemove }: {
  candidates?: CityCandidate[]; status?: CityCandidateStatus; activeId?: string;
  onPick: (candidate: CityCandidate) => void; onRemove?: (id: string) => void; onTrack?: (candidate: CityCandidate) => void;
}) {
  const { state, selectNight, setCandidates } = useStore();
  const candidates = propCandidates ?? state.candidates;
  useCandidateForecasts(candidates);
  const nightKeys = useMemo(() => state.nightKeys.slice(0, 7), [state.nightKeys]);
  const selectedNight = state.selectedNight || nightKeys[0] || "";
  const evaluatedCandidates = useMemo(() => candidates.map((candidate) => {
    const location: Location = { id: candidate.id, name: candidate.name, latitude: candidate.latitude,
      longitude: candidate.longitude, elevation: candidate.elevation ?? null, source: "自定义", province: candidate.province };
    const cached = state.forecastCache.get(candidate.id);
    const sameSelectedPoint = state.selectedLocation && Math.abs(state.selectedLocation.latitude - candidate.latitude) < 1e-6 && Math.abs(state.selectedLocation.longitude - candidate.longitude) < 1e-6;
    const available = cached?.metadata?.model === state.cloudState.model ? cached : sameSelectedPoint ? state.forecast : null;
    const forecast = available?.metadata?.model === state.cloudState.model ? available : null;
    const issue = forecastTrustIssue(forecast);
    const nights = new Map<string, CandidateNightData>();
    nightKeys.forEach((nightKey, index) => {
      const result = forecast && !issue ? evaluateNight(forecast, location, nightKey, index) : null;
      if (result) {
        const meta = statusMeta(result.status);
        const hours = result.hours;
        const probabilities = hours.map((hour) => hour.precipitationProbability);
        nights.set(nightKey, { nightKey, score: result.score, statusTone: meta.tone, statusLabel: meta.label,
          windowLabel: result.windowLabel, windowLength: result.window.length,
          cloud: Math.round(hours.reduce((sum, hour) => sum + hour.cloudCover!, 0) / hours.length),
          precipitation: probabilities.every((value) => typeof value === "number" && Number.isFinite(value)) ? Math.round(Math.max(...probabilities as number[])) : null,
          wind: Math.round(Math.max(...hours.map((hour) => hour.windSpeed!)) * 10) / 10, loading: false });
      } else {
        nights.set(nightKey, { nightKey, score: null, statusTone: "muted", statusLabel: "数据不足",
          windowLabel: issue ?? "关键气象字段或夜间时次不完整", windowLength: 0,
          cloud: null, precipitation: null, wind: null, loading: false });
      }
    });
    const currentNight = nights.get(selectedNight) ?? { nightKey: selectedNight, score: null, statusTone: "muted", statusLabel: "数据不足", windowLabel: "暂无数据", windowLength: 0, cloud: null, precipitation: null, wind: null, loading: false };
    return { candidate, nights, currentNight };
  }), [candidates, nightKeys, selectedNight, state.forecastCache, state.selectedLocation, state.forecast, state.cloudState.model]);
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
      <p className="candidate-footer-hint" role="note">{state.cloudState.model.toUpperCase()} 单模型 · 整晚最佳连续 3 小时分，不是当前时次分或现场保证。缺失/过期数据不排名。</p>
      <div className="candidate-date-tabs" role="tablist" aria-label="7天日期切换">
        {nightKeys.map((key, index) => {
          const { title, sub } = getDateTabLabel(key, index);
          return <button key={key} type="button" role="tab" aria-selected={key === selectedNight} className={`candidate-date-tab ${key === selectedNight ? "candidate-date-tab--active" : ""}`} onClick={() => selectNight(key)} title={`${formatNightLabel(key, true)}；点击按该夜评分重排候选地点`}><span className="candidate-date-tab-title">{title}</span><span className="candidate-date-tab-sub">{sub}</span></button>;
        })}
      </div>
      <div className="candidate-cards-container">
        {!hasCandidates ? <div className="candidate-empty-state">
          <p className="candidate-empty-text">暂无候选对比点位。在地图上点击任意位置，或在右侧详情点击「加入候选对比」，即可纳入 7 天排行榜。</p>
          <button type="button" className="candidate-reset-seeds-btn" onClick={handleResetSeeds}><RotateCcw size={14} /><span>载入 {DEFAULT_CANDIDATE_SEEDS.length} 个精选摄影地点</span></button>
        </div> : sortedCandidates.map(({ candidate, currentNight, nights }, index) => {
          const rank = index + 1;
          const rankClass = currentNight.score === null ? "rank-badge--default" : rank === 1 ? "rank-badge--gold" : rank === 2 ? "rank-badge--silver" : rank === 3 ? "rank-badge--bronze" : "rank-badge--default";
          return <div key={candidate.id} className={`candidate-card ${activeId === candidate.id ? "candidate-card--active" : ""}`} onClick={() => onPick(candidate)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPick(candidate); } }}>
            <div className="candidate-card-top">
              <div className="candidate-card-identity">
                <span className={`candidate-rank-badge ${rankClass}`}>{currentNight.score === null ? "—" : `#${rank}`}</span>
                <div className="candidate-name-box"><span className="candidate-name">{candidate.name}</span><span className="candidate-meta">{candidate.province || "未知"}{candidate.elevation ? ` · ${candidate.elevation}m` : ""}</span></div>
              </div>
              <div className="candidate-card-score-box" title={currentNight.windowLabel}>
                <div className="candidate-score-number"><strong>{currentNight.score ?? "—"}</strong>{currentNight.score !== null && <small>分</small>}</div>
                <span className={`candidate-status-pill tone-${currentNight.statusTone}`}>{currentNight.statusLabel}</span>
                {onRemove && <button type="button" className="candidate-card-delete" onClick={(event) => { event.stopPropagation(); onRemove(candidate.id); }} aria-label={`从候选对比中移除 ${candidate.name}`} title="移出候选对比"><Trash2 size={13} /></button>}
              </div>
            </div>
            <div className="candidate-metrics-row">
              <div className="candidate-metric-item" title="夜间平均总云量（不是当前时次）"><Cloud size={12} className="metric-icon" /><span>云量 {currentNight.cloud != null ? `${currentNight.cloud}%` : "—"}</span></div>
              <div className="candidate-metric-item" title="夜间最高降水概率；缺失不填零"><CloudRain size={12} className="metric-icon" /><span>降水 {currentNight.precipitation != null ? `${currentNight.precipitation}%` : "—"}</span></div>
              <div className="candidate-metric-item" title="夜间最大风速"><Wind size={12} className="metric-icon" /><span>风速 {currentNight.wind != null ? `${currentNight.wind}m/s` : "—"}</span></div>
              <div className="candidate-metric-item" title={currentNight.windowLabel}><Clock size={12} className="metric-icon" /><span>窗口 {currentNight.windowLength > 0 ? `${currentNight.windowLength} 个小时采样` : "无"}</span></div>
            </div>
            <div className="candidate-7day-capsules">{nightKeys.map((key, dayIdx) => {
              const data = nights.get(key), score = data?.score ?? null;
              const tone = score === null ? "" : score >= 80 ? "capsule--great" : score >= 65 ? "capsule--good" : score >= 50 ? "capsule--fair" : "capsule--poor";
              return <button key={key} type="button" className={`mini-capsule ${tone} ${key === selectedNight ? "mini-capsule--active" : ""}`} onClick={(event) => { event.stopPropagation(); selectNight(key); }} title={score === null ? `${formatNightLabel(key, true)}: ${data?.windowLabel ?? "数据不足"}` : `${formatNightLabel(key, true)}: 整晚窗口 ${score}分 (${data?.statusLabel ?? ""})；点击切换`}><span className="mini-capsule-day">{getDayShortLabel(key, dayIdx)}</span><span className="mini-capsule-score">{score ?? "—"}</span></button>;
            })}</div>
          </div>;
        })}
      </div>
      {hasCandidates && <div className="candidate-footer-hint"><span>点击地图任意地点或搜索，在右侧详情中「加入候选对比」参与排名</span></div>}
    </div>
  );
}
