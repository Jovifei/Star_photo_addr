"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Download,
  Eye,
  GitBranch,
  Layers,
  RefreshCcw,
  Search,
  Tag,
  Telescope,
} from "lucide-react";
import type { FinderLabelMode, FinderMode } from "./finderData";
import styles from "./stargazing-finder.module.css";

interface DateOption {
  value: string;
  label: string;
  isTonight?: boolean;
}

interface TopFilterBarProps {
  bortleThreshold: number;
  date: string;
  dateOptions: DateOption[];
  labelMode: FinderLabelMode;
  mode: FinderMode;
  search: string;
  viirsEnabled: boolean;
  isRefreshing: boolean;
  onBortleChange: (value: number) => void;
  onDateChange: (value: string) => void;
  onExport: () => void;
  onLabelModeChange: (value: FinderLabelMode) => void;
  onModeChange: (value: FinderMode) => void;
  onRefresh: () => void;
  onSearchChange: (value: string) => void;
  onToggleViirs: () => void;
  onReview: () => void;
}

export default function TopFilterBar({
  bortleThreshold,
  date,
  dateOptions,
  labelMode,
  mode,
  search,
  viirsEnabled,
  isRefreshing,
  onBortleChange,
  onDateChange,
  onExport,
  onLabelModeChange,
  onModeChange,
  onRefresh,
  onSearchChange,
  onToggleViirs,
  onReview,
}: TopFilterBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.brandBlock}>
        <Link href="/" className={styles.backButton} aria-label="返回逐星">
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <Link href="/integration-plan" className={styles.planLink} aria-label="查看逐星产品合并方案">
          <GitBranch size={14} aria-hidden="true" />
          <span>合并方案</span>
        </Link>
        <span className={styles.brandMark} aria-hidden="true"><Telescope size={19} /></span>
        <div className={styles.brandText}>
          <div className={styles.brandTitle}>全国观星地点查询 <span>（公测版）</span></div>
          <div className={styles.brandSubtitle}>光污染等级 + 天气预报 · 筛选最佳观星窗口</div>
        </div>
      </div>

      <div className={styles.filterBar} aria-label="观星筛选工具">
        <label className={styles.filterControl}>
          <span>光污染等级</span>
          <select value={bortleThreshold} onChange={(event) => onBortleChange(Number(event.target.value))} aria-label="光污染等级">
            <option value={1}>1级（极暗空）</option>
            <option value={2}>2级（暗空）</option>
            <option value={3}>3级（乡村）</option>
            <option value={4}>4级（郊区）</option>
          </select>
        </label>

        <div className={styles.filterControl}>
          <span>光污染底图</span>
          <button type="button" className={`${styles.controlButton} ${viirsEnabled ? styles.activeLayer : ""}`} onClick={onToggleViirs} aria-pressed={viirsEnabled}>
            <Layers size={14} aria-hidden="true" /> VIIRS 2023
          </button>
        </div>

        <label className={styles.filterControl}>
          <span><Tag size={13} aria-hidden="true" /> 标签</span>
          <select value={labelMode} onChange={(event) => onLabelModeChange(event.target.value as FinderLabelMode)} aria-label="地点标签模式">
            <option value="all">全开</option>
            <option value="qualified">符合地区</option>
            <option value="off">全关</option>
          </select>
        </label>

        <div className={styles.modeGroup} aria-label="观测模式">
          <button type="button" className={`${styles.modeButton} ${mode === "photo" ? styles.modeActive : ""}`} onClick={() => onModeChange("photo")} aria-pressed={mode === "photo"}>
            <Camera size={14} aria-hidden="true" /> 摄影
          </button>
          <button type="button" className={`${styles.modeButton} ${mode === "visual" ? styles.modeActive : ""}`} onClick={() => onModeChange("visual")} aria-pressed={mode === "visual"}>
            <Eye size={14} aria-hidden="true" /> 肉眼
          </button>
        </div>

        <label className={styles.searchBox}>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">搜索地点名或省份</span>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="搜索地点名/省份..." aria-label="搜索地点名或省份" />
        </label>

        <label className={styles.dateControl}>
          <span>观测日期</span>
          <select value={date} onChange={(event) => onDateChange(event.target.value)} aria-label="观测日期">
            {dateOptions.map((option) => <option value={option.value} key={option.value}>{option.isTonight ? "今晚 " : "日期 "}{option.label}</option>)}
          </select>
        </label>

        <button type="button" className={styles.secondaryButton} onClick={onExport}>
          <Download size={14} aria-hidden="true" /> 导出Excel
        </button>
        <button type="button" className={styles.secondaryButton} onClick={onReview}>
          <CheckCircle2 size={14} aria-hidden="true" /> 复查
        </button>
        <button type="button" className={`${styles.secondaryButton} ${styles.refreshButton}`} onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCcw size={14} aria-hidden="true" className={isRefreshing ? styles.spin : undefined} /> {isRefreshing ? "刷新中" : "刷新天气"}
        </button>
      </div>
    </header>
  );
}
