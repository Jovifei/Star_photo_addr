"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import FinderLegend from "./FinderLegend";
import FinderReviewModal from "./FinderReviewModal";
import FinderStatus from "./FinderStatus";
import LocationDetail from "./LocationDetail";
import TopFilterBar from "./TopFilterBar";
import {
  addFinderDays,
  dateLabel,
  FINDER_LOCATIONS,
  formatFinderDate,
  weekdayLabel,
  type FinderLabelMode,
  type FinderMode,
} from "./finderData";
import { evaluateFinderLocation, wmoToType } from "@/lib/stargazingFinder";
import type { FinderEvaluation, FinderHourlyData, FinderLocation, FinderWeatherResponse } from "@/lib/stargazingFinderTypes";
import styles from "./stargazing-finder.module.css";

const FinderMap = dynamic(() => import("./FinderMap"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>正在加载暗空地图…</div>,
});

interface StargazingFinderAppProps {
  initialDate: string;
}

function formatCell(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined || !Number.isFinite(value) ? "—" : `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

export default function StargazingFinderApp({ initialDate }: StargazingFinderAppProps) {
  const today = initialDate;
  const [date, setDate] = useState(today);
  const [bortleThreshold, setBortleThreshold] = useState(3);
  const [labelMode, setLabelMode] = useState<FinderLabelMode>("all");
  const [mode, setMode] = useState<FinderMode>("photo");
  const [search, setSearch] = useState("");
  const [viirsEnabled, setViirsEnabled] = useState(true);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [weather, setWeather] = useState<FinderWeatherResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [notice, setNotice] = useState("已显示今晚观星地点，正在加载天气数据");
  const [mapDegraded, setMapDegraded] = useState(false);

  const dateOptions = useMemo(() => Array.from({ length: 5 }, (_, index) => {
    const value = addFinderDays(today, index);
    return { value, label: `${formatFinderDate(value)} 周${weekdayLabel(value)}`, isTonight: index === 0 };
  }), [today]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/stargazing-finder/weather?date=${encodeURIComponent(date)}&refresh=${refreshToken}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload: unknown = await response.json();
        if (!response.ok) throw new Error(typeof payload === "object" && payload !== null && "error" in payload ? String(payload.error) : "天气接口请求失败");
        return payload as FinderWeatherResponse;
      })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setWeather(payload);
        const loaded = Object.values(payload.data).filter((record) => record.status === "available" || record.status === "stale").length;
        setNotice(payload.stale ? `天气数据已加载，${loaded}/${FINDER_LOCATIONS.length} 个地点可用（部分降级）` : `天气数据已加载，${loaded} 个地点已查`);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setNotice(error instanceof Error ? error.message : "天气接口暂不可用，地点仍可浏览");
      })
      .finally(() => { if (!controller.signal.aborted) setIsRefreshing(false); });
    return () => controller.abort();
  }, [date, refreshToken]);

  const evaluations = useMemo(() => new Map<string, FinderEvaluation>(FINDER_LOCATIONS.map((location) => [location.id, evaluateFinderLocation(location, weather?.data[location.id], date, mode)])), [date, mode, weather]);

  const visibleLocations = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return FINDER_LOCATIONS.filter((location) => {
      if (location.bortle > bortleThreshold) return false;
      if (labelMode === "qualified" && !["perfect", "great", "good"].includes(evaluations.get(location.id)?.rating ?? "unknown")) return false;
      if (!query) return true;
      return `${location.name}${location.province}${location.area}`.toLocaleLowerCase().includes(query);
    });
  }, [bortleThreshold, evaluations, labelMode, search]);

  const searchResults = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return [];
    return FINDER_LOCATIONS.filter((location) => `${location.name}${location.province}${location.area}`.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [search]);

  const selectedLocation = useMemo<FinderLocation | null>(() => FINDER_LOCATIONS.find((location) => location.id === selectedId) ?? null, [selectedId]);
  const stats = useMemo(() => {
    const weatherCount = visibleLocations.filter((location) => ["available", "stale"].includes(weather?.data[location.id]?.status ?? "")).length;
    return {
      count: visibleLocations.length,
      darkCount: visibleLocations.filter((location) => location.bortle <= 2).length,
      weatherCount,
      qualifiedCount: visibleLocations.filter((location) => evaluations.get(location.id)?.rating === "perfect").length,
      totalWeatherCount: FINDER_LOCATIONS.filter((location) => ["available", "stale"].includes(weather?.data[location.id]?.status ?? "")).length,
    };
  }, [evaluations, visibleLocations, weather]);

  const exportExcel = () => {
    const hourlyFields: Array<{ key: keyof Omit<FinderHourlyData, "time">; label: string; suffix?: string }> = [
      { key: "weather_code", label: "天气" },
      { key: "cloud_cover", label: "总云量", suffix: "%" },
      { key: "cloud_cover_high", label: "高云", suffix: "%" },
      { key: "cloud_cover_mid", label: "中云", suffix: "%" },
      { key: "cloud_cover_low", label: "低云", suffix: "%" },
      { key: "precipitation", label: "降水", suffix: " mm" },
      { key: "wind_speed_10m", label: "风速", suffix: " m/s" },
      { key: "wind_gusts_10m", label: "阵风", suffix: " m/s" },
      { key: "temperature_2m", label: "温度", suffix: " °C" },
    ];
    const firstHourly = visibleLocations.map((location) => weather?.data[location.id]?.hourly).find((hourly): hourly is FinderHourlyData => Boolean(hourly));
    const hourlyColumns = firstHourly?.time.flatMap((time, index) => hourlyFields.map((field) => ({
      label: `${time.replace("T", " ")} ${field.label}`,
      getValue: (hourly: FinderHourlyData | null) => {
        if (!hourly) return "—";
        const value = hourly[field.key][index];
        return field.key === "weather_code" ? wmoToType(value) : formatCell(value, field.suffix);
      },
    }))) ?? [];
    const header = ["省份", "地点", "区域", "光污染等级", "评级", "观星分", "夜间云量", "夜间最大风速", "夜间最大阵风", "高海拔预警", "风险提示", "天气状态", ...hourlyColumns.map((column) => column.label)];
    const rows = visibleLocations.map((location) => {
      const evaluation = evaluations.get(location.id);
      const record = weather?.data[location.id];
      const nightCloud = evaluation?.analysis?.mode === "visual" ? evaluation.analysis.visualCloudyPct : evaluation?.analysis?.nightCloudyPct;
      return [location.province, location.name, location.area, `B${location.bortle}`, evaluation ? (evaluation.rating === "unknown" ? "暂无数据" : evaluation.rating) : "暂无数据", evaluation?.score ?? "—", nightCloud === undefined ? "—" : `${Math.round(nightCloud * 100)}%`, formatCell(evaluation?.analysis?.nightMaxWind, " m/s"), formatCell(evaluation?.analysis?.nightMaxGust, " m/s"), evaluation?.altitudeWarning?.text ?? "—", evaluation?.hazardWarning ?? "—", record?.status ?? "missing", ...hourlyColumns.map((column) => column.getValue(record?.hourly ?? null))];
    });
    const qualifiedRows = rows.filter((_, index) => ["perfect", "great", "good"].includes(evaluations.get(visibleLocations[index]?.id ?? "")?.rating ?? ""));
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const table = (title: string, tableRows: Array<Array<unknown>>) => `<h2>${escapeHtml(title)}</h2><table><thead><tr>${header.map((cell) => `<th>${escapeHtml(cell)}</th>`).join("")}</tr></thead><tbody>${tableRows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,"Microsoft YaHei",sans-serif}table{border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #b8c5d1;padding:4px 6px;white-space:nowrap}th{background:#dce8f4}</style></head><body>${table("全部地点", rows)}${table("符合条件", qualifiedRows)}</body></html>`;
    const blob = new Blob(["\uFEFF", html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `观星地点-${date}.xls`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice(`已导出 ${visibleLocations.length} 个地点的 Excel 兼容数据，包含 ${firstHourly?.time.length ?? 0} 个时次`);
  };

  return (
    <main className={styles.page}>
      <TopFilterBar
        bortleThreshold={bortleThreshold}
        date={date}
        dateOptions={dateOptions}
        labelMode={labelMode}
        mode={mode}
        search={search}
        viirsEnabled={viirsEnabled}
        isRefreshing={isRefreshing}
        onBortleChange={setBortleThreshold}
        onDateChange={(value) => { setIsRefreshing(true); setNotice(`${formatFinderDate(value)} 天气数据加载中…`); setDate(value); setSelectedId(null); }}
        onExport={exportExcel}
        onLabelModeChange={setLabelMode}
        onModeChange={setMode}
        onRefresh={() => { setIsRefreshing(true); setNotice("正在刷新天气数据…"); setRefreshToken((value) => value + 1); }}
        onSearchChange={setSearch}
        onToggleViirs={() => { setViirsEnabled((value) => !value); setMapDegraded(false); }}
        onReview={() => setReviewOpen(true)}
      />

      <section className={styles.mapStage} aria-label="全国观星地点地图">
        <FinderMap key={viirsEnabled ? "viirs-layer" : "base-layer"} locations={visibleLocations} weather={weather?.data ?? {}} selectedId={selectedId} targetDate={date} mode={mode} onSelect={(location) => { setSelectedId(location.id); setSearch(""); }} showLabels={labelMode !== "off"} viirsEnabled={viirsEnabled} onViirsError={() => { setMapDegraded(true); setNotice("VIIRS 2023 底图暂不可用，已切换暗色基础地图"); }} />
        <FinderLegend collapsed={legendCollapsed} mode={mode} viirsEnabled={viirsEnabled && !mapDegraded} weatherStatus={isRefreshing && !weather ? "loading" : weather?.stale || mapDegraded ? "degraded" : weather ? "available" : "loading"} refreshedAt={weather?.fetchedAt ? new Date(weather.fetchedAt).toLocaleString("zh-CN", { hour12: false }) : null} selectedDate={dateLabel(date, date === today)} visibleCount={visibleLocations.length} totalCount={FINDER_LOCATIONS.length} onToggle={() => setLegendCollapsed((current) => !current)} onCloseMobile={() => setLegendCollapsed(true)} />
        <FinderStatus {...stats} date={dateLabel(date, date === today)} isRefreshing={isRefreshing} />

        {searchResults.length > 0 && <div className={styles.searchResults} role="listbox" aria-label="地点搜索结果">
          <div className={styles.searchResultsHeader}><span><Search size={13} aria-hidden="true" /> 搜索结果</span><button type="button" onClick={() => setSearch("")} aria-label="清除搜索"><X size={14} /></button></div>
          {searchResults.map((location) => <button type="button" key={location.id} className={styles.searchResult} onClick={() => { setSelectedId(location.id); setSearch(""); }}><span><strong>{location.name}</strong><small>{location.province} · {location.area}</small></span><b>B{location.bortle}</b></button>)}
        </div>}
        <div className={styles.notice} aria-live="polite">{notice}</div>
      </section>

      <LocationDetail date={date} mode={mode} location={selectedLocation} record={selectedLocation ? weather?.data[selectedLocation.id] : undefined} onClose={() => setSelectedId(null)} />
      {reviewOpen && <FinderReviewModal locations={visibleLocations} evaluations={evaluations} onClose={() => setReviewOpen(false)} />}
    </main>
  );
}
