"use client";

import { useMemo, useState, useCallback } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { cachedForecast, useStore } from "@/lib/store";
import { useCandidateForecasts } from "@/hooks/useCandidateForecasts";
import { statusMeta } from "@/lib/scoring";
import { projectCandidateNight } from "@/lib/candidateNightEvidence";
import { formatNightLabel } from "@/lib/nighttime";
import type { ForecastModel, Location, SortDirection } from "@/lib/types";

type Cell = { evidence: ReturnType<typeof projectCandidateNight>; loading: boolean };
function formatModel(model: string): string {
  return model === "best_match" ? "最佳匹配" : model.toUpperCase();
}
function metricValue(value: number | null, unit: string, digits = 0): string {
  if (value === null) return "—";
  return `${digits ? value.toFixed(digits) : Math.round(value)}${unit}`;
}
function samePoint(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): boolean {
  return Math.abs(a.latitude - b.latitude) < 1e-6 && Math.abs(a.longitude - b.longitude) < 1e-6;
}
/** Consumes the same candidate request service. Never borrows scores by fuzzy place name/distance. */
export default function StarWindowTable() {
  const { state, addCandidate, removeCandidate, selectLocation, setCandidateForecastModel } = useStore();
  const { candidates, nightKeys, forecastCache, selectedLocation } = state;
  const candidateForecastError = useCandidateForecasts(candidates);
  const selectedForecastRequest = useMemo(() => {
    if (!selectedLocation || candidates.some((candidate) => samePoint(candidate, selectedLocation))) return [];
    return [{ id: `selected:${selectedLocation.id}`, latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }];
  }, [selectedLocation, candidates]);
  const selectedForecastError = useCandidateForecasts(selectedForecastRequest);
  const requestError = candidateForecastError ?? selectedForecastError;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [addInput, setAddInput] = useState("");
  const [addError, setAddError] = useState("");
  const tableLocations = useMemo(() => {
    const rows: Array<Location & { isCandidate: boolean }> = [];
    if (selectedLocation) rows.push({ ...selectedLocation, isCandidate: false });
    for (const candidate of candidates) {
      if (rows.some((row) => row.id === candidate.id)) continue;
      rows.push({ id: candidate.id, name: candidate.name, latitude: candidate.latitude, longitude: candidate.longitude,
        elevation: candidate.elevation ?? null, source: "参考点位", bortle: candidate.bortle, isCandidate: true });
    }
    return rows;
  }, [selectedLocation, candidates]);
  const scoreMatrix = useMemo(() => {
    const matrix = new Map<string, Map<string, Cell>>();
    for (const location of tableLocations) {
      const row = new Map<string, Cell>();
      const matchingCandidate = location.isCandidate ? null : candidates.find((candidate) => samePoint(candidate, location));
      const cacheId = location.isCandidate ? location.id : matchingCandidate?.id ?? `selected:${location.id}`;
      const cached = cachedForecast(forecastCache, cacheId, state.candidateForecastModel);
      const available = cached?.metadata?.model === state.candidateForecastModel
        ? cached
        : !location.isCandidate ? state.forecast : null;
      const forecast = available?.metadata?.model === state.candidateForecastModel ? available : null;
      const locationRequestError =
        location.isCandidate || matchingCandidate
          ? candidateForecastError
          : selectedForecastError;
      nightKeys.forEach((night, leadIndex) => {
        row.set(night, {
          evidence: projectCandidateNight(forecast, location, night, leadIndex, state.candidateForecastModel),
          // Candidate evidence owns its own request lifecycle. A slow raster
          // request must not hide an already-resolved Best Match table row.
          loading: !forecast && !locationRequestError,
        });
      });
      matrix.set(location.id, row);
    }
    return matrix;
  }, [
    tableLocations,
    candidates,
    nightKeys,
    forecastCache,
    state.forecast,
    state.candidateForecastModel,
    candidateForecastError,
    selectedForecastError,
  ]);
  const sortedLocations = useMemo(() => {
    if (!sortKey) return tableLocations;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...tableLocations].sort((a, b) => {
      const left = scoreMatrix.get(a.id)?.get(sortKey)?.evidence.evaluation?.score ?? null;
      const right = scoreMatrix.get(b.id)?.get(sortKey)?.evidence.evaluation?.score ?? null;
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      return (left - right) * direction;
    });
  }, [tableLocations, sortKey, sortDir, scoreMatrix]);
  const handleSort = useCallback((night: string) => {
    if (sortKey === night) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(night); setSortDir("desc"); }
  }, [sortKey, sortDir]);
  const handleAddLocation = useCallback(() => {
    const parts = addInput.trim().split(/[,，\s]+/).filter(Boolean);
    const latitude = Number(parts[0]), longitude = Number(parts[1]);
    if (parts.length < 2 || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setAddError("请输入有效坐标：纬度 -90～90，经度 -180～180。"); return;
    }
    addCandidate({ id: `custom-${Date.now()}`, name: parts.slice(2).join(" ") || `自定义(${latitude.toFixed(2)}, ${longitude.toFixed(2)})`, latitude, longitude, elevation: null, source: "自定义" });
    setAddError(""); setAddInput("");
    // The shared hook reacts to the new candidate exactly once. No second direct fetch here.
  }, [addInput, addCandidate]);
  const handleRowClick = useCallback((location: (typeof tableLocations)[0]) => {
    if (location.isCandidate) void selectLocation(location);
  }, [selectLocation]);
  const missingVisibility = [...scoreMatrix.values()].some((row) => [...row.values()].some((cell) =>
    cell.evidence.blockedFields.some((field) => field.label === "能见度"),
  ));
  return (
    <div className="panel-section">
      <div className="panel-head"><div><span className="panel-kicker">星空窗口</span><h3>星空核心窗口</h3></div><span style={{ fontSize: 11, color: "var(--muted)" }}>{sortedLocations.length} 个地点</span></div>
      <p className="panel-kicker">{formatModel(state.candidateForecastModel)} 候选评分模型 · 整晚最佳连续 3 小时预报分，不是当前时刻。缺失字段会保留可用原始天气但不发布评分，且不借用附近地点或另一套快照分数。</p>
      <label className="candidate-model-select">候选评分模型
        <select aria-label="候选评分模型" value={state.candidateForecastModel} onChange={(event) => setCandidateForecastModel(event.currentTarget.value as ForecastModel)}>
          <option value="best_match">最佳匹配</option><option value="icon">ICON</option><option value="gfs">GFS</option><option value="aifs">AIFS</option>
        </select>
      </label>
      {state.candidateForecastModel !== "best_match" && missingVisibility && <button type="button" className="candidate-model-switch-btn" onClick={() => setCandidateForecastModel("best_match")} title="以同一套最佳匹配点位预报重新计算候选评分；如必需字段仍缺失，继续暂缓评分。">切换到最佳匹配模型重算</button>}
      {requestError && <p className="candidate-request-status" data-testid="candidate-forecast-request-status" role="status">天气请求未完成（{formatModel(state.candidateForecastModel)}）：{requestError}。当前没有新鲜的同模型天气可用于评分，分数和排序继续暂缓。</p>}
      <div className="star-window-table-wrap"><table className="star-window-table">
        <thead><tr><th className="star-window-loc-col">地点</th>{nightKeys.map((night) => <th key={night} className={`star-window-date-col${sortKey === night ? " sorted" : ""}`} aria-sort={sortKey === night ? sortDir === "asc" ? "ascending" : "descending" : "none"}>
          <button type="button" title={`${formatNightLabel(night, false)}；点击按该夜评分排序地点`} onClick={() => handleSort(night)}><span>{formatNightLabel(night, true)}</span>{sortKey === night ? sortDir === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" /> : null}</button>
        </th>)}<th className="star-window-action-col" /></tr></thead>
        <tbody>{sortedLocations.map((location) => <tr key={location.id} className={selectedLocation?.id === location.id ? "active" : ""}>
          <td className="star-window-loc-cell"><button type="button" className="star-window-location-button" disabled={!location.isCandidate} onClick={() => handleRowClick(location)}><span className="star-window-loc-name">{location.name}</span></button>{(location.bortle ?? 0) > 0 && <span className="bortle-chip">参考 B{location.bortle}</span>}</td>
          {nightKeys.map((night) => {
            const cell = scoreMatrix.get(location.id)?.get(night);
            if (cell?.loading) return <td key={night} className="star-window-cell loading"><span className="cell-loading">…</span></td>;
            const evidence = cell?.evidence;
            const evaluation = evidence?.evaluation;
            if (!evidence || !evaluation) {
              const hasFacts = Boolean(evidence && (evidence.metrics.cloudCover.value !== null || evidence.metrics.precipitationProbability.value !== null || evidence.metrics.windSpeed.value !== null));
              const rawSummary = evidence
                ? `云 ${metricValue(evidence.metrics.cloudCover.value, "%")} · 降水 ${metricValue(evidence.metrics.precipitationProbability.value, "%")} · 风 ${metricValue(evidence.metrics.windSpeed.value, "m/s", 1)}`
                : "";
              const provenance = evidence?.sourceFetchedAt ? ` · ${formatModel(evidence.model ?? state.cloudState.model)} · 原始抓取 ${evidence.sourceFetchedAt}` : "";
              const title = evidence ? `${evidence.reason}${rawSummary ? `；${rawSummary}` : ""}${provenance}` : "暂无天气数据";
              return <td key={night} className="star-window-cell muted" title={title} aria-label={`${location.name}，${formatNightLabel(night, true)}，${title}`}>
                <span className="cell-score">—</span><span className="cell-status">{evidence?.statusLabel ?? "数据不足"}</span>
                {hasFacts && <small className="cell-evidence">云 {metricValue(evidence!.metrics.cloudCover.value, "%")} · 风 {metricValue(evidence!.metrics.windSpeed.value, "m/s", 1)}</small>}
              </td>;
            }
            const meta = statusMeta(evaluation.status);
            return <td key={night} className={`star-window-cell ${meta.tone}`} title={evaluation.reason} aria-label={`${location.name}，${formatNightLabel(night, true)}，${evaluation.score} 分，${meta.label}`}><span className="cell-score">{evaluation.score}</span><span className="cell-status">{meta.label}</span></td>;
          })}
          <td className="star-window-action-cell">{location.isCandidate && <button type="button" className="row-delete" onClick={(event) => { event.stopPropagation(); removeCandidate(location.id); }} aria-label="删除"><Trash2 size={15} aria-hidden="true" /></button>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="star-window-add"><input type="text" className="star-window-add-input" placeholder="输入坐标添加地点（如 30.5,114.3,武汉）" aria-label="添加地点坐标与名称" aria-describedby={addError ? "star-window-add-error" : undefined} value={addInput} onChange={(event) => setAddInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleAddLocation(); }} /><button type="button" className="star-window-add-btn" onClick={handleAddLocation} disabled={!addInput.trim()}>添加</button></div>
      {addError && <p id="star-window-add-error" className="star-window-add-error" role="alert">{addError}</p>}
    </div>
  );
}
