"use client";

import { ChevronDown, Database, Info, Layers, X } from "lucide-react";
import type { FinderMode } from "./finderData";
import { FINDER_LEGEND_ROWS, FINDER_RISK_ROWS, FINDER_MAP_SOURCE, FINDER_SOURCE } from "./finderData";
import styles from "./stargazing-finder.module.css";

interface FinderLegendProps {
  collapsed: boolean;
  mode: FinderMode;
  viirsEnabled: boolean;
  weatherStatus: "loading" | "available" | "degraded";
  refreshedAt: string | null;
  selectedDate: string;
  visibleCount: number;
  totalCount: number;
  onToggle: () => void;
  onCloseMobile: () => void;
}

export default function FinderLegend({ collapsed, mode, viirsEnabled, weatherStatus, refreshedAt, selectedDate, visibleCount, totalCount, onToggle, onCloseMobile }: FinderLegendProps) {
  const modeText = mode === "photo"
    ? "摄影：中低云 > 10% 或高云 > 30% 计为有云"
    : "肉眼：中低云 > 30% 或高云 > 70% 计为有云";
  const statusText = weatherStatus === "loading" ? "正在加载天气" : weatherStatus === "available" ? "天气数据已加载" : "部分地点天气降级";

  return (
    <aside className={`${styles.legend} ${collapsed ? styles.legendCollapsed : ""}`} aria-label="地图图例">
      <div className={styles.legendHeader}>
        <div className={styles.legendTitle}><Info size={14} aria-hidden="true" /><h2>全国观星地点查询</h2></div>
        <span className={styles.legendCount}>{visibleCount}/{totalCount}</span>
        <button type="button" className={styles.legendToggle} onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "展开图例" : "折叠图例"}>
          <ChevronDown size={15} className={collapsed ? styles.chevronCollapsed : ""} aria-hidden="true" />
        </button>
        <button type="button" className={styles.legendCloseMobile} onClick={onCloseMobile} aria-label="关闭图例"><X size={15} /></button>
      </div>

      {!collapsed && <div className={styles.legendBody}>
        <p className={styles.legendIntro}>{modeText}</p>
        <div className={styles.legendRows}>
          {FINDER_LEGEND_ROWS.map((row) => <div className={styles.legendRow} key={row.label}>
            <span className={`${styles.legendDot} ${styles[`dot${row.color}`]}`} aria-hidden="true" />
            <strong>{row.label}</strong><span>{row.description}</span>
          </div>)}
        </div>
        <div className={styles.riskRows}>
          {FINDER_RISK_ROWS.map((row) => <div className={styles.riskRow} key={row.label}>
            <span className={styles.riskIcon} aria-hidden="true">{row.symbol}</span>
            <strong>{row.label}</strong><span>{row.description}</span>
          </div>)}
        </div>
        <div className={styles.refreshCard}>
          <strong><Database size={13} aria-hidden="true" /> {statusText}</strong>
          <span>{refreshedAt ? `最近刷新：${refreshedAt}` : "等待首轮请求"}</span>
        </div>
        <div className={styles.sourceNotes}>
          <span><Layers size={11} aria-hidden="true" /> {viirsEnabled ? FINDER_MAP_SOURCE : "CARTO 暗色底图（降级/关闭 VIIRS）"}</span>
          <span>天气：Open-Meteo · 日期：{selectedDate} · 夜间：19:00–次日 04:00</span>
          <span>地点来源：{FINDER_SOURCE}</span>
          <span>颜色 + 文字共同表达评级，缺失数据显示为 —</span>
        </div>
      </div>}
    </aside>
  );
}
