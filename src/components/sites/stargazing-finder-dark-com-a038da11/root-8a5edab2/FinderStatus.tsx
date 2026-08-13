"use client";

import { CheckCircle2, CloudSun, Database, MapPinned } from "lucide-react";
import styles from "./stargazing-finder.module.css";

interface FinderStatusProps {
  count: number;
  darkCount: number;
  date: string;
  isRefreshing: boolean;
  qualifiedCount: number;
  weatherCount: number;
  totalWeatherCount: number;
}

export default function FinderStatus({ count, darkCount, date, isRefreshing, qualifiedCount, weatherCount, totalWeatherCount }: FinderStatusProps) {
  const status = isRefreshing ? "正在刷新天气数据" : weatherCount === totalWeatherCount ? "天气数据已加载" : weatherCount > 0 ? "天气数据部分加载" : "等待天气数据";
  return (
    <aside className={styles.statusPanel} aria-live="polite">
      <div className={styles.statusHeading}>
        {isRefreshing ? <CloudSun className={styles.spin} size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
        <span>{status} · {date}</span>
      </div>
      <div className={styles.statGrid}>
        <span><MapPinned size={13} aria-hidden="true" /><b>{count}</b> 个地点</span>
        <span><Database size={13} aria-hidden="true" /><b>{darkCount}</b> 个暗区</span>
        <span><CloudSun size={13} aria-hidden="true" /><b>{weatherCount}</b> 天气已查</span>
        <span><CheckCircle2 size={13} aria-hidden="true" /><b>{qualifiedCount}</b> 完全符合</span>
      </div>
    </aside>
  );
}
