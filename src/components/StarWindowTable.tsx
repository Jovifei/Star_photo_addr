"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { evaluateNight, statusMeta } from "@/lib/scoring";
import { formatNightLabel } from "@/lib/nighttime";
import type {
  ForecastModel,
  Location,
  LocationForecast,
  SortDirection,
} from "@/lib/types";

/**
 * Fetch a forecast for a location and cache it in the store.
 * Reused internally by StarWindowTable when a candidate lacks a forecast.
 */
async function fetchAndCacheForecast(
  location: Location,
  model: ForecastModel,
  cacheForecast: (id: string, forecast: LocationForecast) => void,
): Promise<void> {
  const url = `/api/forecast?latitude=${location.latitude}&longitude=${location.longitude}&days=14&model=${model}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const data = await response.json();
    const forecast: LocationForecast | null = data.locations?.[0] ?? null;
    if (forecast) {
      cacheForecast(location.id, forecast);
    }
  } catch {
    // Silently fail — the cell will remain in loading state.
  }
}

/**
 * 星空核心窗口 — multi-location × multi-date scoring table.
 *
 * Replaces the old horizontal-scrolling night-button strip in SidePanel.
 *
 * Features:
 *   - Rows = locations (selected location + candidates).
 *   - Columns = observation nights (with weekday labels).
 *   - Each cell shows score + status (go/watch/no/trend).
 *   - Clicking a date header toggles asc/desc sort.
 *   - Each candidate row has a delete (✕) button.
 *   - "添加地点" input accepts "lat,lng" or "lat,lng,name".
 *   - Loading state while forecasts are being fetched.
 */
export default function StarWindowTable() {
  const {
    state,
    addCandidate,
    removeCandidate,
    cacheForecast,
    selectLocation,
  } = useStore();
  const { candidates, nightKeys, forecastCache, selectedLocation } =
    state;

  // Sort state.
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Add-location input state.
  const [addInput, setAddInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  // Build the list of table rows (selected location first, then candidates).
  const tableLocations = useMemo(() => {
    const locs: Array<{ id: string; name: string; lat: number; lng: number; bortle: number; isCandidate: boolean }> = [];
    if (selectedLocation) {
      locs.push({
        id: selectedLocation.id,
        name: selectedLocation.name,
        lat: selectedLocation.latitude,
        lng: selectedLocation.longitude,
        bortle: selectedLocation.bortle ?? 0,
        isCandidate: false,
      });
    }
    for (const c of candidates) {
      if (locs.some((l) => l.id === c.id)) continue;
      locs.push({
        id: c.id,
        name: c.name,
        lat: c.latitude,
        lng: c.longitude,
        bortle: c.bortle,
        isCandidate: true,
      });
    }
    return locs;
  }, [selectedLocation, candidates]);

  // Fetch missing forecasts for candidates (not the selected location, which
  // already has its forecast in state.forecast).
  useEffect(() => {
    for (const loc of tableLocations) {
      if (loc.isCandidate && forecastCache.get(loc.id)?.metadata?.model !== state.cloudState.model) {
        const location: Location = {
          id: loc.id,
          name: loc.name,
          latitude: loc.lat,
          longitude: loc.lng,
          elevation: 0,
          source: "参考点位",
          bortle: loc.bortle,
        };
        void fetchAndCacheForecast(location, state.cloudState.model, cacheForecast);
      }
    }
  }, [tableLocations, forecastCache, cacheForecast, state.cloudState.model]);

  // Compute scores for each location × night.
  const scoreMatrix = useMemo(() => {
    const matrix = new Map<
      string,
      Map<string, { score: number; status: string; loading: boolean }>
    >();

    for (const loc of tableLocations) {
      const rowMap = new Map<
        string,
        { score: number; status: string; loading: boolean }
      >();
      const candidateForecast = loc.isCandidate
        ? (forecastCache.get(loc.id) ?? null)
        : state.forecast;
      const forecast = candidateForecast?.metadata?.model === state.cloudState.model
        ? candidateForecast
        : null;

      for (const night of nightKeys) {
        if (!forecast) {
          rowMap.set(night, { score: 0, status: "no", loading: true });
          continue;
        }
        const location: Location = {
          id: loc.id,
          name: loc.name,
          latitude: loc.lat,
          longitude: loc.lng,
          elevation: 0,
          source: "参考点位",
          bortle: loc.bortle,
        };
        const leadIndex = Math.max(0, nightKeys.indexOf(night));
        const evalResult = evaluateNight(forecast, location, night, leadIndex);
        if (evalResult) {
          rowMap.set(night, {
            score: evalResult.score,
            status: evalResult.status,
            loading: false,
          });
        } else {
          rowMap.set(night, { score: 0, status: "no", loading: true });
        }
      }
      matrix.set(loc.id, rowMap);
    }
    return matrix;
  }, [tableLocations, nightKeys, forecastCache, state.forecast, state.cloudState.model]);

  // Sort locations by the selected sort key.
  const sortedLocations = useMemo(() => {
    if (!sortKey) return tableLocations;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...tableLocations].sort((a, b) => {
      const scoreA = scoreMatrix.get(a.id)?.get(sortKey)?.score ?? 0;
      const scoreB = scoreMatrix.get(b.id)?.get(sortKey)?.score ?? 0;
      return (scoreA - scoreB) * dir;
    });
  }, [tableLocations, sortKey, sortDir, scoreMatrix]);

  const handleSort = useCallback(
    (night: string) => {
      if (sortKey === night) {
        setSortDir(sortDir === "asc" ? "desc" : "asc");
      } else {
        setSortKey(night);
        setSortDir("desc");
      }
    },
    [sortKey, sortDir],
  );

  const handleAddLocation = useCallback(() => {
    const input = addInput.trim();
    if (!input) return;
    setAdding(true);
    setAddError("");

    // Parse "lat,lng" or "lat,lng,name" or "lat lng name".
    const parts = input.split(/[,，\s]+/).filter(Boolean);
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    const name = parts.slice(2).join(" ") || `自定义(${lat.toFixed(2)}, ${lng.toFixed(2)})`;

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setAddError("请输入有效坐标：纬度 -90～90，经度 -180～180。");
      setAdding(false);
      return;
    }

    const location: Location = {
      id: `custom-${Date.now()}`,
      name,
      latitude: lat,
      longitude: lng,
      elevation: 0,
      source: "自定义",
    };

    addCandidate(location);
    void fetchAndCacheForecast(location, state.cloudState.model, cacheForecast).finally(() => {
      setAdding(false);
      setAddInput("");
    });
  }, [addInput, addCandidate, cacheForecast, state.cloudState.model]);

  const handleDelete = useCallback(
    (id: string) => {
      removeCandidate(id);
    },
    [removeCandidate],
  );

  const handleRowClick = useCallback(
    (loc: (typeof tableLocations)[0]) => {
      if (!loc.isCandidate) return;
      // Clicking a candidate row selects it as the main location.
      const location: Location = {
        id: loc.id,
        name: loc.name,
        latitude: loc.lat,
        longitude: loc.lng,
        elevation: 0,
        source: "参考点位",
        bortle: loc.bortle,
      };
      void selectLocation(location);
    },
    [selectLocation],
  );

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">星空窗口</span>
          <h3>星空核心窗口</h3>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {sortedLocations.length} 个地点
        </span>
      </div>

      <div className="star-window-table-wrap">
        <table className="star-window-table">
          <thead>
            <tr>
              <th className="star-window-loc-col">地点</th>
              {nightKeys.map((night) => (
                <th
                  key={night}
                  className={`star-window-date-col${sortKey === night ? " sorted" : ""}`}
                  aria-sort={
                    sortKey === night
                      ? sortDir === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    type="button"
                    title={`${formatNightLabel(night, false)}；点击按该夜评分排序地点`}
                    onClick={() => handleSort(night)}
                  >
                    <span>{formatNightLabel(night, true)}</span>
                    {sortKey === night ? (
                      sortDir === "asc" ? (
                        <ArrowUp size={13} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={13} aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
              <th className="star-window-action-col" />
            </tr>
          </thead>
          <tbody>
            {sortedLocations.map((loc) => {
              const rowScores = scoreMatrix.get(loc.id);
              const isActive = selectedLocation?.id === loc.id;
              return (
                <tr
                  key={loc.id}
                  className={isActive ? "active" : ""}
                >
                  <td className="star-window-loc-cell">
                    <button
                      type="button"
                      className="star-window-location-button"
                      disabled={!loc.isCandidate}
                      onClick={() => handleRowClick(loc)}
                    >
                      <span className="star-window-loc-name">{loc.name}</span>
                    </button>
                    {loc.bortle > 0 && (
                      <span className="bortle-chip">B{loc.bortle}</span>
                    )}
                  </td>
                  {nightKeys.map((night) => {
                    const cell = rowScores?.get(night);
                    if (!cell || cell.loading) {
                      return (
                        <td key={night} className="star-window-cell loading">
                          <span className="cell-loading">…</span>
                        </td>
                      );
                    }
                    const meta = statusMeta(cell.status as never);
                    return (
                      <td key={night} className={`star-window-cell ${meta.tone}`}>
                        <span className="cell-score">{cell.score}</span>
                        <span className="cell-status">{meta.label}</span>
                      </td>
                    );
                  })}
                  <td className="star-window-action-cell">
                    {loc.isCandidate && (
                      <button
                        type="button"
                        className="row-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(loc.id);
                        }}
                        aria-label="删除"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add location input */}
      <div className="star-window-add">
        <input
          type="text"
          className="star-window-add-input"
          placeholder="输入坐标添加地点（如 30.5,114.3,武汉）"
          aria-label="添加地点坐标与名称"
          aria-describedby={addError ? "star-window-add-error" : undefined}
          value={addInput}
          onChange={(e) => setAddInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddLocation();
          }}
          disabled={adding}
        />
        <button
          type="button"
          className="star-window-add-btn"
          onClick={handleAddLocation}
          disabled={adding || !addInput.trim()}
        >
          {adding ? "添加中…" : "添加"}
        </button>
      </div>
      {addError && (
        <p id="star-window-add-error" className="star-window-add-error" role="alert">
          {addError}
        </p>
      )}
    </div>
  );
}
