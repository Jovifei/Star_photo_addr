"use client";

import { useMemo, useState, useCallback } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useCandidateForecasts } from "@/hooks/useCandidateForecasts";
import { evaluateNight, statusMeta } from "@/lib/scoring";
import { formatNightLabel } from "@/lib/nighttime";
import type { Location, NightStatus, SortDirection } from "@/lib/types";

type Cell = { score: number | null; status: NightStatus | "unknown"; loading: boolean };
/** Consumes the same candidate request service. Never borrows scores by fuzzy place name/distance. */
export default function StarWindowTable() {
  const { state, addCandidate, removeCandidate, selectLocation } = useStore();
  const { candidates, nightKeys, forecastCache, selectedLocation } = state;
  useCandidateForecasts(candidates);
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
      const available = location.isCandidate ? forecastCache.get(location.id) : state.forecast;
      const forecast = available?.metadata?.model === state.cloudState.model ? available : null;
      nightKeys.forEach((night, leadIndex) => {
        const result = forecast ? evaluateNight(forecast, location, night, leadIndex) : null;
        row.set(night, result ? { score: result.score, status: result.status, loading: false } : {
          score: null, status: "unknown", loading: !location.isCandidate && state.loading,
        });
      });
      matrix.set(location.id, row);
    }
    return matrix;
  }, [tableLocations, nightKeys, forecastCache, state.forecast, state.cloudState.model, state.loading]);
  const sortedLocations = useMemo(() => {
    if (!sortKey) return tableLocations;
    const direction = sortDir === "asc" ? 1 : -1;
    return [...tableLocations].sort((a, b) => {
      const left = scoreMatrix.get(a.id)?.get(sortKey)?.score ?? null;
      const right = scoreMatrix.get(b.id)?.get(sortKey)?.score ?? null;
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
  return (
    <div className="panel-section">
      <div className="panel-head"><div><span className="panel-kicker">星空窗口</span><h3>星空核心窗口</h3></div><span style={{ fontSize: 11, color: "var(--muted)" }}>{sortedLocations.length} 个地点</span></div>
      <p className="panel-kicker">{state.cloudState.model.toUpperCase()} 整晚最佳连续 3 小时预报分；不是当前时刻。数据不足不借用附近地点或另一套快照分数。</p>
      <div className="star-window-table-wrap"><table className="star-window-table">
        <thead><tr><th className="star-window-loc-col">地点</th>{nightKeys.map((night) => <th key={night} className={`star-window-date-col${sortKey === night ? " sorted" : ""}`} aria-sort={sortKey === night ? sortDir === "asc" ? "ascending" : "descending" : "none"}>
          <button type="button" title={`${formatNightLabel(night, false)}；点击按该夜评分排序地点`} onClick={() => handleSort(night)}><span>{formatNightLabel(night, true)}</span>{sortKey === night ? sortDir === "asc" ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" /> : null}</button>
        </th>)}<th className="star-window-action-col" /></tr></thead>
        <tbody>{sortedLocations.map((location) => <tr key={location.id} className={selectedLocation?.id === location.id ? "active" : ""}>
          <td className="star-window-loc-cell"><button type="button" className="star-window-location-button" disabled={!location.isCandidate} onClick={() => handleRowClick(location)}><span className="star-window-loc-name">{location.name}</span></button>{(location.bortle ?? 0) > 0 && <span className="bortle-chip">参考 B{location.bortle}</span>}</td>
          {nightKeys.map((night) => {
            const cell = scoreMatrix.get(location.id)?.get(night);
            if (cell?.loading) return <td key={night} className="star-window-cell loading"><span className="cell-loading">…</span></td>;
            if (!cell || cell.score === null || cell.status === "unknown") return <td key={night} className="star-window-cell muted"><span className="cell-score">—</span><span className="cell-status">数据不足</span></td>;
            const meta = statusMeta(cell.status);
            return <td key={night} className={`star-window-cell ${meta.tone}`}><span className="cell-score">{cell.score}</span><span className="cell-status">{meta.label}</span></td>;
          })}
          <td className="star-window-action-cell">{location.isCandidate && <button type="button" className="row-delete" onClick={(event) => { event.stopPropagation(); removeCandidate(location.id); }} aria-label="删除"><Trash2 size={15} aria-hidden="true" /></button>}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="star-window-add"><input type="text" className="star-window-add-input" placeholder="输入坐标添加地点（如 30.5,114.3,武汉）" aria-label="添加地点坐标与名称" aria-describedby={addError ? "star-window-add-error" : undefined} value={addInput} onChange={(event) => setAddInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleAddLocation(); }} /><button type="button" className="star-window-add-btn" onClick={handleAddLocation} disabled={!addInput.trim()}>添加</button></div>
      {addError && <p id="star-window-add-error" className="star-window-add-error" role="alert">{addError}</p>}
    </div>
  );
}
